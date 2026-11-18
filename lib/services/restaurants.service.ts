import { AdminSession } from '../auth';
import { query, withTransaction } from '../db';
import { callGoDudeAdminApi } from '../godude-api';
import { buildSortClause, insertNotification, recordAuditLog } from './shared';

export interface RestaurantListRow {
  id: string;
  name: string;
  tagline: string;
  city: string;
  address: string;
  approval_status: string;
  store_status: string;
  is_open: boolean;
  rating: number;
  review_count: number;
  delivery_time_mins: number;
  delivery_fee_lkr: number;
  commission_pct: number;
  contact_phone: string;
  rejection_reason: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  menu_count: number;
  orders_count: number;
  created_at: string;
}

export async function listRestaurants(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [];

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    clauses.push(`r.approval_status = $${values.length}`);
  }

  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(r.name ILIKE ${p} OR r.city ILIKE ${p} OR r.address ILIKE ${p} OR COALESCE(r.contact_phone, '') ILIKE ${p} OR COALESCE(u.full_name, '') ILIKE ${p} OR COALESCE(u.phone, '') ILIKE ${p})`
    );
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'r.created_at',
      name: 'r.name',
      city: 'r.city',
      rating: 'r.rating',
      approval_status: 'r.approval_status',
    },
    'r.created_at'
  );

  const [countRes, summaryRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM restaurants r
       LEFT JOIN users u ON u.id = r.owner_user_id
       ${whereSql}`,
      values
    ),
    query<{
      total: string;
      pending: string;
      approved: string;
      rejected: string;
      suspended: string;
      open_now: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE approval_status = 'pending')::text AS pending,
         COUNT(*) FILTER (WHERE approval_status = 'approved')::text AS approved,
         COUNT(*) FILTER (WHERE approval_status = 'rejected')::text AS rejected,
         COUNT(*) FILTER (WHERE approval_status = 'suspended')::text AS suspended,
         COUNT(*) FILTER (WHERE is_open = TRUE AND approval_status = 'approved')::text AS open_now
       FROM restaurants`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query<RestaurantListRow>(
    `SELECT
       r.id,
       r.name,
       r.tagline,
       r.city,
       r.address,
       r.approval_status,
       r.store_status,
       r.is_open,
       r.rating::float8 AS rating,
       r.review_count,
       r.delivery_time_mins,
       r.delivery_fee_lkr,
       r.commission_pct::float8 AS commission_pct,
       r.contact_phone,
       r.rejection_reason,
       r.owner_user_id,
       u.full_name AS owner_name,
       u.phone AS owner_phone,
       u.email AS owner_email,
       (SELECT COUNT(*) FROM food_items fi WHERE fi.restaurant_id = r.id AND fi.is_deleted = FALSE)::int AS menu_count,
       (SELECT COUNT(*) FROM bookings b WHERE b.restaurant_id = r.id)::int AS orders_count,
       r.created_at::text
     FROM restaurants r
     LEFT JOIN users u ON u.id = r.owner_user_id
     ${whereSql}
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const s = summaryRes.rows[0];
  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      total: Number(s?.total ?? 0),
      pending: Number(s?.pending ?? 0),
      approved: Number(s?.approved ?? 0),
      rejected: Number(s?.rejected ?? 0),
      suspended: Number(s?.suspended ?? 0),
      openNow: Number(s?.open_now ?? 0),
    },
  };
}

export async function getRestaurantDetail(id: string) {
  const [restRes, menuRes, addonsRes, ordersRes, auditRes, notifRes] = await Promise.all([
    query(
      `SELECT r.*,
              r.rating::float8 AS rating,
              r.distance_km::float8 AS distance_km,
              r.delivery_radius_km::float8 AS delivery_radius_km,
              r.commission_pct::float8 AS commission_pct,
              r.created_at::text, r.updated_at::text,
              u.id AS owner_id, u.account_id AS owner_account_id,
              u.full_name AS owner_name, u.phone AS owner_phone,
              u.email AS owner_email, u.role AS owner_role
       FROM restaurants r
       LEFT JOIN users u ON u.id = r.owner_user_id
       WHERE r.id = $1 LIMIT 1`,
      [id]
    ),
    query(
      `SELECT id, name, category, description, price_lkr, promo_price_lkr,
              large_price_delta_lkr, is_popular, is_spicy, prep_time_mins,
              calories, image_url, is_available, min_addons, max_addons
       FROM food_items
       WHERE restaurant_id = $1 AND is_deleted = FALSE
       ORDER BY category ASC, name ASC`,
      [id]
    ),
    query(
      `SELECT fa.id, fa.food_item_id, fa.label, fa.price_lkr, fa.group_name, fa.is_required, fa.is_available
       FROM food_addons fa
       JOIN food_items fi ON fi.id = fa.food_item_id
       WHERE fi.restaurant_id = $1 AND fi.is_deleted = FALSE`,
      [id]
    ),
    query(
      `SELECT b.id, b.status, b.total_paid_lkr, b.payment_method, b.created_at::text,
              c.full_name AS customer_name
       FROM bookings b
       JOIN users c ON c.id = b.customer_id
       WHERE b.restaurant_id = $1
       ORDER BY b.created_at DESC
       LIMIT 20`,
      [id]
    ),
    query(
      `SELECT a.id, a.action, a.reason, a.details, a.created_at::text,
              COALESCE(u.full_name, 'Platform Admin') AS admin_name
       FROM admin_audit_logs a
       LEFT JOIN users u ON u.id = a.admin_user_id
       WHERE a.target_type = 'restaurant' AND a.target_id = $1
       ORDER BY a.created_at DESC
       LIMIT 30`,
      [id]
    ),
    query(
      `SELECT n.id, n.event_type, n.title, n.body, n.is_read, n.created_at::text
       FROM notifications n
       WHERE n.data->>'restaurantId' = $1
       ORDER BY n.created_at DESC
       LIMIT 25`,
      [id]
    ),
  ]);

  if (!restRes.rows[0]) return null;

  return {
    restaurant: restRes.rows[0],
    menuItems: menuRes.rows,
    addons: addonsRes.rows,
    recentOrders: ordersRes.rows,
    approvalHistory: auditRes.rows,
    notificationsHistory: notifRes.rows,
  };
}

export async function reviewRestaurantAction(
  session: AdminSession,
  restaurantId: string,
  payload: {
    decision: 'approved' | 'rejected' | 'suspended' | 'request_info';
    reason?: string;
    commissionPct?: number;
  }
) {
  const restLookup = await query<{
    id: string;
    name: string;
    owner_user_id: string | null;
    approval_status: string;
  }>(
    `SELECT id, name, owner_user_id, approval_status FROM restaurants WHERE id = $1 LIMIT 1`,
    [restaurantId]
  );
  const rest = restLookup.rows[0];
  if (!rest) {
    throw new Error('Restaurant not found');
  }

  if (
    (payload.decision === 'rejected' ||
      payload.decision === 'suspended' ||
      payload.decision === 'request_info') &&
    !payload.reason?.trim()
  ) {
    throw new Error('Please provide a reason or instructions for this action.');
  }

  const nextStatus = payload.decision === 'request_info' ? 'pending' : payload.decision;

  // Call existing GoDude backend approval workflow when available for real-time socket sync
  const apiRes = await callGoDudeAdminApi(session, `/restaurants/${restaurantId}/approval`, {
    method: 'PATCH',
    body: {
      approvalStatus: nextStatus,
      rejectionReason: payload.reason?.trim() || undefined,
      commissionPct: payload.commissionPct,
    },
  });

  if (apiRes.reached && !apiRes.ok) {
    throw new Error(apiRes.error || 'Backend rejected restaurant approval update');
  }

  await withTransaction(async (client) => {
    if (!apiRes.reached) {
      await client.query(
        `UPDATE restaurants
         SET approval_status = $2,
             rejection_reason = CASE
               WHEN $3 <> '' THEN $3
               WHEN $2 = 'approved' THEN NULL
               ELSE rejection_reason
             END,
             commission_pct = COALESCE($4, commission_pct),
             is_open = CASE WHEN $2 IN ('rejected', 'suspended') THEN FALSE ELSE is_open END,
             store_status = CASE WHEN $2 IN ('rejected', 'suspended') THEN 'CLOSED' ELSE store_status END,
             updated_at = NOW()
         WHERE id = $1`,
        [restaurantId, nextStatus, payload.reason?.trim() || '', payload.commissionPct ?? null]
      );
    } else if (payload.decision === 'rejected' || payload.decision === 'suspended') {
      await client.query(
        `UPDATE restaurants SET is_open = FALSE, store_status = 'CLOSED', updated_at = NOW() WHERE id = $1`,
        [restaurantId]
      );
    }

    if (rest.owner_user_id) {
      const notifConfig = {
        approved: {
          eventType: 'restaurant_application_approved',
          title: `Restaurant Approved: ${rest.name}`,
          body:
            payload.reason?.trim() ||
            `Congratulations! "${rest.name}" is approved and live for customer ordering on GoDude Foods.`,
        },
        rejected: {
          eventType: 'restaurant_application_rejected',
          title: `Restaurant Application Rejected: ${rest.name}`,
          body: payload.reason!.trim(),
        },
        suspended: {
          eventType: 'restaurant_account_suspended',
          title: `Restaurant Suspended: ${rest.name}`,
          body: payload.reason!.trim(),
        },
        request_info: {
          eventType: 'restaurant_additional_info_requested',
          title: `Action Required for ${rest.name}`,
          body: payload.reason!.trim(),
        },
      }[payload.decision];

      await insertNotification(
        {
          userId: rest.owner_user_id,
          roleTarget: 'merchant',
          eventType: notifConfig.eventType,
          title: notifConfig.title,
          body: notifConfig.body,
          data: {
            restaurantId,
            decision: payload.decision,
            approvalStatus: nextStatus,
            commissionPct: payload.commissionPct,
          },
        },
        client
      );
    }

    await recordAuditLog(
      {
        adminUserId: session.dbUserId,
        action: `restaurant_${payload.decision}`,
        targetType: 'restaurant',
        targetId: restaurantId,
        reason: payload.reason?.trim() || '',
        details: {
          previousStatus: rest.approval_status,
          nextStatus,
          commissionPct: payload.commissionPct,
          backendSynced: apiRes.ok,
        },
      },
      client
    );
  });

  return { ok: true, approvalStatus: nextStatus, backendSynced: apiRes.ok };
}

export async function toggleRestaurantOpenAction(
  session: AdminSession,
  restaurantId: string,
  isOpen: boolean
) {
  const apiRes = await callGoDudeAdminApi(session, `/restaurants/${restaurantId}/toggle`, {
    method: 'PATCH',
    body: { isOpen },
  });
  if (apiRes.reached && !apiRes.ok) {
    throw new Error(apiRes.error || 'Failed to update restaurant store status');
  }
  if (!apiRes.reached) {
    const upd = await query(
      `UPDATE restaurants
       SET is_open = $2,
           store_status = CASE WHEN $2 THEN 'OPEN' ELSE 'CLOSED' END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [restaurantId, isOpen]
    );
    if (!upd.rows[0]) throw new Error('Restaurant not found');
  }
  await recordAuditLog({
    adminUserId: session.dbUserId,
    action: isOpen ? 'restaurant_opened' : 'restaurant_closed',
    targetType: 'restaurant',
    targetId: restaurantId,
  });
  return { ok: true, isOpen };
}
