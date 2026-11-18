import { AdminSession } from '../auth';
import { query, withTransaction } from '../db';
import { callGoDudeAdminApi } from '../godude-api';
import { buildSortClause, insertNotification, recordAuditLog } from './shared';

export async function listRides(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [`b.service_type IN ('Ride Booking', 'Flexible Ride')`];

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    clauses.push(`b.status = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    clauses.push(`b.created_at >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    clauses.push(`b.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(b.id ILIKE ${p} OR b.title ILIKE ${p} OR b.pickup_address ILIKE ${p} OR b.destination_address ILIKE ${p} OR c.full_name ILIKE ${p} OR COALESCE(c.phone, '') ILIKE ${p} OR COALESCE(du.full_name, '') ILIKE ${p})`
    );
  }

  const whereSql = `WHERE ${clauses.join(' AND ')}`;
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'b.created_at',
      total_paid_lkr: 'b.total_paid_lkr',
      status: 'b.status',
    },
    'b.created_at'
  );

  const [countRes, statsRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM bookings b
       JOIN users c ON c.id = b.customer_id
       LEFT JOIN drivers d ON d.id = b.driver_id
       LEFT JOIN users du ON du.id = d.user_id
       ${whereSql}`,
      values
    ),
    query<{ total: string; active: string; completed: string; cancelled: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status IN ('Searching', 'Rider Assigned', 'Arrived', 'On the Way'))::text AS active,
         COUNT(*) FILTER (WHERE status = 'Completed')::text AS completed,
         COUNT(*) FILTER (WHERE status = 'Cancelled')::text AS cancelled
       FROM bookings WHERE service_type IN ('Ride Booking', 'Flexible Ride')`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query(
    `SELECT b.id, b.service_type, b.booking_mode, b.title, b.subtitle, b.status,
            b.vehicle_type, b.payment_method, b.payment_status,
            b.pickup_address, b.destination_address,
            b.estimated_distance_km::float8 AS distance_km,
            b.total_paid_lkr, b.rider_earnings_lkr, b.platform_commission_lkr,
            b.created_at::text, b.started_at::text, b.completed_at::text,
            c.id AS customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
            d.id AS driver_id, du.full_name AS driver_name, d.plate_number
     FROM bookings b
     JOIN users c ON c.id = b.customer_id
     LEFT JOIN drivers d ON d.id = b.driver_id
     LEFT JOIN users du ON du.id = d.user_id
     ${whereSql}
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const s = statsRes.rows[0];
  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      total: Number(s?.total ?? 0),
      active: Number(s?.active ?? 0),
      completed: Number(s?.completed ?? 0),
      cancelled: Number(s?.cancelled ?? 0),
    },
  };
}

export async function listFoodOrders(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [`b.service_type = 'Food Delivery'`];

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    clauses.push(`b.status = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    clauses.push(`b.created_at >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    clauses.push(`b.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(b.id ILIKE ${p} OR b.title ILIKE ${p} OR b.destination_address ILIKE ${p} OR COALESCE(r.name, '') ILIKE ${p} OR c.full_name ILIKE ${p} OR COALESCE(du.full_name, '') ILIKE ${p})`
    );
  }

  const whereSql = `WHERE ${clauses.join(' AND ')}`;
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'b.created_at',
      total_paid_lkr: 'b.total_paid_lkr',
      status: 'b.status',
    },
    'b.created_at'
  );

  const [countRes, statsRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM bookings b
       JOIN users c ON c.id = b.customer_id
       LEFT JOIN restaurants r ON r.id = b.restaurant_id
       LEFT JOIN drivers d ON d.id = b.driver_id
       LEFT JOIN users du ON du.id = d.user_id
       ${whereSql}`,
      values
    ),
    query<{ total: string; active: string; delivered: string; cancelled: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status IN ('Searching', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Rider Assigned', 'Arrived', 'On the Way'))::text AS active,
         COUNT(*) FILTER (WHERE status IN ('Delivered', 'Completed'))::text AS delivered,
         COUNT(*) FILTER (WHERE status = 'Cancelled')::text AS cancelled
       FROM bookings WHERE service_type = 'Food Delivery'`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query(
    `SELECT b.id, b.status, b.progress_step, b.title, b.subtitle,
            b.payment_method, b.payment_status, b.destination_address,
            b.subtotal_lkr, b.delivery_or_service_fee_lkr, b.discount_lkr,
            b.total_paid_lkr, b.estimated_prep_mins, b.items_summary,
            b.created_at::text, b.completed_at::text,
            c.id AS customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
            r.id AS restaurant_id, r.name AS restaurant_name, r.city AS restaurant_city,
            d.id AS driver_id, du.full_name AS driver_name, d.plate_number
     FROM bookings b
     JOIN users c ON c.id = b.customer_id
     LEFT JOIN restaurants r ON r.id = b.restaurant_id
     LEFT JOIN drivers d ON d.id = b.driver_id
     LEFT JOIN users du ON du.id = d.user_id
     ${whereSql}
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const s = statsRes.rows[0];
  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      total: Number(s?.total ?? 0),
      active: Number(s?.active ?? 0),
      delivered: Number(s?.delivered ?? 0),
      cancelled: Number(s?.cancelled ?? 0),
    },
  };
}

export async function listParcels(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [`b.service_type = 'Parcel Delivery'`];

  if (params.status && params.status !== 'all') {
    values.push(params.status);
    clauses.push(`b.status = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    clauses.push(`b.created_at >= $${values.length}::date`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    clauses.push(`b.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(b.id ILIKE ${p} OR b.pickup_address ILIKE ${p} OR b.destination_address ILIKE ${p} OR c.full_name ILIKE ${p} OR COALESCE(pd.sender_name, '') ILIKE ${p} OR COALESCE(pd.recipient_name, '') ILIKE ${p} OR COALESCE(pd.parcel_category, '') ILIKE ${p} OR COALESCE(du.full_name, '') ILIKE ${p})`
    );
  }

  const whereSql = `WHERE ${clauses.join(' AND ')}`;
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'b.created_at',
      total_paid_lkr: 'b.total_paid_lkr',
      status: 'b.status',
    },
    'b.created_at'
  );

  const [countRes, statsRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM bookings b
       JOIN users c ON c.id = b.customer_id
       LEFT JOIN parcel_deliveries pd ON pd.booking_id = b.id
       LEFT JOIN drivers d ON d.id = b.driver_id
       LEFT JOIN users du ON du.id = d.user_id
       ${whereSql}`,
      values
    ),
    query<{ total: string; active: string; delivered: string; failed_or_cancelled: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status IN ('Searching', 'Rider Assigned', 'Arrived', 'On the Way', 'Return Initiated'))::text AS active,
         COUNT(*) FILTER (WHERE status IN ('Delivered', 'Completed'))::text AS delivered,
         COUNT(*) FILTER (WHERE status IN ('Cancelled', 'Delivery Failed', 'Returned to Sender'))::text AS failed_or_cancelled
       FROM bookings WHERE service_type = 'Parcel Delivery'`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query(
    `SELECT b.id, b.status, b.vehicle_type, b.pickup_address, b.destination_address,
            b.total_paid_lkr, b.rider_earnings_lkr, b.platform_commission_lkr,
            b.payment_method, b.payment_status, b.estimated_distance_km::float8 AS distance_km,
            b.created_at::text, b.completed_at::text,
            c.id AS customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
            d.id AS driver_id, du.full_name AS driver_name, d.plate_number,
            pd.sender_name, pd.sender_phone, pd.recipient_name, pd.recipient_phone,
            pd.parcel_category, pd.parcel_count, pd.weight_kg::float8 AS weight_kg,
            pd.is_fragile, pd.lifecycle_stage, pd.failure_reason, pd.return_reason
     FROM bookings b
     JOIN users c ON c.id = b.customer_id
     LEFT JOIN parcel_deliveries pd ON pd.booking_id = b.id
     LEFT JOIN drivers d ON d.id = b.driver_id
     LEFT JOIN users du ON du.id = d.user_id
     ${whereSql}
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const s = statsRes.rows[0];
  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      total: Number(s?.total ?? 0),
      active: Number(s?.active ?? 0),
      delivered: Number(s?.delivered ?? 0),
      failedOrCancelled: Number(s?.failed_or_cancelled ?? 0),
    },
  };
}

export async function getBookingDetail(bookingId: string) {
  const [bookingRes, parcelRes, parcelHistRes, foodItemsRes, paymentsRes, dispatchesRes] =
    await Promise.all([
      query(
        `SELECT b.*,
                b.estimated_distance_km::float8 AS estimated_distance_km,
                b.actual_distance_km::float8 AS actual_distance_km,
                b.created_at::text, b.updated_at::text,
                b.started_at::text, b.completed_at::text,
                b.restaurant_accepted_at::text, b.ready_for_pickup_at::text, b.picked_up_at::text,
                c.full_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.account_id AS customer_account_id,
                d.vehicle_type AS driver_vehicle_type, d.vehicle_name AS driver_vehicle_name, d.plate_number AS driver_plate,
                du.full_name AS driver_name, du.phone AS driver_phone,
                r.name AS restaurant_name, r.city AS restaurant_city, r.address AS restaurant_address, r.contact_phone AS restaurant_phone,
                (SELECT COUNT(*) FROM ride_gps_breadcrumbs rgb WHERE rgb.booking_id = b.id)::int AS breadcrumb_count
         FROM bookings b
         JOIN users c ON c.id = b.customer_id
         LEFT JOIN drivers d ON d.id = b.driver_id
         LEFT JOIN users du ON du.id = d.user_id
         LEFT JOIN restaurants r ON r.id = b.restaurant_id
         WHERE b.id = $1 LIMIT 1`,
        [bookingId]
      ),
      query(
        `SELECT booking_id, sender_name, sender_phone, pickup_instructions,
                recipient_name, recipient_phone, delivery_instructions,
                parcel_category, parcel_description, parcel_count,
                weight_kg::float8 AS weight_kg, length_cm, width_cm, height_cm,
                is_fragile, handling_precautions, lifecycle_stage,
                pickup_verified_at::text, parcel_condition,
                arrived_at_dest_at::text, delivery_verified_at::text,
                recipient_verified_name, failure_reason, failed_at::text,
                return_reason, return_initiated_at::text, returned_at::text,
                pricing_snapshot
         FROM parcel_deliveries
         WHERE booking_id = $1 LIMIT 1`,
        [bookingId]
      ),
      query(
        `SELECT h.id, h.from_stage, h.to_stage, h.actor_role, h.notes, h.metadata, h.created_at::text,
                COALESCE(u.full_name, h.actor_role) AS actor_name
         FROM parcel_status_history h
         LEFT JOIN users u ON u.id = h.actor_user_id
         WHERE h.booking_id = $1
         ORDER BY h.created_at ASC`,
        [bookingId]
      ),
      query(
        `SELECT id, food_item_id, food_name, quantity, portion, spice_level,
                selected_addons, special_instructions, unit_total_lkr
         FROM booking_food_items
         WHERE booking_id = $1`,
        [bookingId]
      ),
      query(
        `SELECT id, method, amount_lkr, currency, status, gateway_ref,
                refund_amount_lkr, refunded_at::text, created_at::text
         FROM payment_transactions
         WHERE booking_id = $1
         ORDER BY created_at DESC`,
        [bookingId]
      ),
      query(
        `SELECT rd.id, rd.driver_id, rd.distance_to_pickup_km::float8 AS distance_km,
                rd.status, rd.offered_at::text, rd.responded_at::text,
                u.full_name AS driver_name, d.plate_number
         FROM ride_dispatches rd
         JOIN drivers d ON d.id = rd.driver_id
         JOIN users u ON u.id = d.user_id
         WHERE rd.booking_id = $1
         ORDER BY rd.offered_at DESC`,
        [bookingId]
      ),
    ]);

  if (!bookingRes.rows[0]) return null;
  return {
    booking: bookingRes.rows[0],
    parcelDetails: parcelRes.rows[0] ?? null,
    parcelTimeline: parcelHistRes.rows,
    foodItems: foodItemsRes.rows,
    payments: paymentsRes.rows,
    dispatches: dispatchesRes.rows,
  };
}

export async function cancelBookingAdminAction(
  session: AdminSession,
  bookingId: string,
  reason: string
) {
  const apiRes = await callGoDudeAdminApi(session, `/bookings/${bookingId}/cancel`, {
    method: 'POST',
    body: { reason: reason.trim() || 'Cancelled by GoDude Admin Operations' },
  });
  if (apiRes.reached) {
    if (!apiRes.ok) {
      throw new Error(apiRes.error || 'Failed to cancel booking via GoDude backend');
    }
    return { ok: true, backendSynced: true };
  }

  return withTransaction(async (client) => {
    const bRes = await client.query<{
      id: string;
      customer_id: string;
      driver_id: string | null;
      status: string;
      total_paid_lkr: number;
    }>(`SELECT id, customer_id, driver_id, status, total_paid_lkr FROM bookings WHERE id = $1 FOR UPDATE`, [
      bookingId,
    ]);
    const b = bRes.rows[0];
    if (!b) throw new Error('Booking not found');
    if (b.status === 'Completed' || b.status === 'Delivered' || b.status === 'Cancelled') {
      throw new Error(`Cannot cancel booking already in status "${b.status}".`);
    }

    await client.query(
      `UPDATE bookings
       SET status = 'Cancelled', payment_status = 'Refunded',
           cancelled_reason = $2, updated_at = NOW()
       WHERE id = $1`,
      [bookingId, reason.trim() || 'Cancelled by GoDude Admin Operations']
    );

    if (b.driver_id) {
      await client.query(
        `UPDATE drivers
         SET active_booking_id = NULL, active_service_type = NULL,
             is_available = CASE WHEN is_online THEN TRUE ELSE FALSE END,
             driver_state = CASE WHEN is_online THEN 'AVAILABLE' ELSE 'OFFLINE' END,
             updated_at = NOW(), last_state_changed_at = NOW()
         WHERE id = $1 AND active_booking_id = $2`,
        [b.driver_id, bookingId]
      );
    }

    await client.query(
      `UPDATE payment_transactions
       SET status = 'refunded', refund_amount_lkr = amount_lkr, refunded_at = NOW()
       WHERE booking_id = $1 AND status = 'verified'`,
      [bookingId]
    );

    await insertNotification(
      {
        userId: b.customer_id,
        bookingId,
        roleTarget: 'customer',
        eventType: 'booking_admin_cancelled',
        title: `Booking ${bookingId} Cancelled`,
        body: reason.trim() || 'Cancelled by GoDude Admin Operations.',
      },
      client
    );

    await recordAuditLog(
      {
        adminUserId: session.dbUserId,
        action: 'booking_cancel',
        targetType: 'booking',
        targetId: bookingId,
        reason: reason.trim(),
      },
      client
    );

    return { ok: true, backendSynced: false };
  });
}

export async function reassignParcelAdminAction(
  session: AdminSession,
  bookingId: string,
  reason: string
) {
  const apiRes = await callGoDudeAdminApi(session, `/parcels/${bookingId}/reassign`, {
    method: 'POST',
    body: { reason: reason.trim() || 'Admin parcel reassignment' },
  });
  if (apiRes.reached) {
    if (!apiRes.ok) {
      throw new Error(apiRes.error || 'Failed to reassign parcel via backend');
    }
    return { ok: true, backendSynced: true };
  }

  return withTransaction(async (client) => {
    const bRes = await client.query<{ driver_id: string | null; status: string }>(
      `SELECT driver_id, status FROM bookings WHERE id = $1 AND service_type = 'Parcel Delivery' FOR UPDATE`,
      [bookingId]
    );
    const b = bRes.rows[0];
    if (!b) throw new Error('Parcel booking not found');
    if (b.status === 'Delivered' || b.status === 'Cancelled' || b.status === 'Returned to Sender') {
      throw new Error(`Cannot reassign parcel in terminal status "${b.status}".`);
    }

    await client.query(
      `UPDATE bookings SET driver_id = NULL, status = 'Searching', progress_step = 1, updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );
    await client.query(
      `UPDATE parcel_deliveries SET lifecycle_stage = 'SEARCHING_FOR_RIDER', updated_at = NOW() WHERE booking_id = $1`,
      [bookingId]
    );
    if (b.driver_id) {
      await client.query(
        `UPDATE drivers
         SET active_booking_id = NULL, active_service_type = NULL,
             is_available = CASE WHEN is_online THEN TRUE ELSE FALSE END,
             driver_state = CASE WHEN is_online THEN 'AVAILABLE' ELSE 'OFFLINE' END,
             updated_at = NOW(), last_state_changed_at = NOW()
         WHERE id = $1 AND active_booking_id = $2`,
        [b.driver_id, bookingId]
      );
    }

    await recordAuditLog(
      {
        adminUserId: session.dbUserId,
        action: 'parcel_reassign',
        targetType: 'booking',
        targetId: bookingId,
        reason: reason.trim() || 'Admin reassignment',
      },
      client
    );
    return { ok: true, backendSynced: false };
  });
}
