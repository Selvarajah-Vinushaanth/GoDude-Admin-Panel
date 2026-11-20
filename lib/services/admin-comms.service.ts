import { AdminSession } from '../auth';
import { query } from '../db';
import { callGoDudeAdminApi } from '../godude-api';
import { authoritativeIsCustomerSql, insertNotification, recordAuditLog } from './shared';

export async function listNotifications(params: {
  page: number;
  pageSize: number;
  search?: string;
  roleTarget?: string;
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [];

  if (params.roleTarget && params.roleTarget !== 'all') {
    values.push(params.roleTarget);
    clauses.push(`n.role_target = $${values.length}`);
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(n.title ILIKE ${p} OR n.body ILIKE ${p} OR n.event_type ILIKE ${p} OR u.full_name ILIKE ${p} OR COALESCE(u.phone, '') ILIKE ${p})`
    );
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [countRes, statsRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       ${whereSql}`,
      values
    ),
    query<{
      total: string;
      unread: string;
      merchant: string;
      driver: string;
      customer: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_read = FALSE)::text AS unread,
         COUNT(*) FILTER (WHERE role_target = 'merchant')::text AS merchant,
         COUNT(*) FILTER (WHERE role_target = 'driver')::text AS driver,
         COUNT(*) FILTER (WHERE role_target = 'customer')::text AS customer
       FROM notifications`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query(
    `SELECT n.id, n.user_id, n.booking_id, n.role_target, n.event_type,
            n.title, n.body, n.data, n.is_read, n.created_at::text,
            u.account_id AS recipient_account_id,
            u.full_name AS recipient_name, u.phone AS recipient_phone, u.role AS recipient_role
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     ${whereSql}
     ORDER BY n.created_at DESC
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
      unread: Number(s?.unread ?? 0),
      merchant: Number(s?.merchant ?? 0),
      driver: Number(s?.driver ?? 0),
      customer: Number(s?.customer ?? 0),
    },
  };
}

export async function searchNotificationRecipients(roleTarget: string, q: string) {
  const search = `%${q.trim()}%`;
  if (roleTarget === 'merchant') {
    const res = await query(
      `SELECT u.id AS user_id, u.full_name, u.phone, r.id AS restaurant_id, r.name AS label, r.city
       FROM restaurants r
       JOIN users u ON u.id = r.owner_user_id
       WHERE r.owner_user_id IS NOT NULL
         AND (r.name ILIKE $1 OR u.full_name ILIKE $1 OR COALESCE(u.phone, '') ILIKE $1)
       ORDER BY r.created_at DESC
       LIMIT 25`,
      [search]
    );
    return res.rows;
  }

  if (roleTarget === 'driver') {
    const res = await query(
      `SELECT u.id AS user_id, u.full_name, u.phone, d.id AS driver_id,
              (d.vehicle_name || ' · ' || d.plate_number) AS label, d.operating_city AS city
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE u.full_name ILIKE $1 OR COALESCE(u.phone, '') ILIKE $1 OR d.plate_number ILIKE $1
       ORDER BY d.updated_at DESC
       LIMIT 25`,
      [search]
    );
    return res.rows;
  }

  const res = await query(
    `SELECT u.id AS user_id, u.full_name, u.phone, u.account_id AS label, u.selected_location_id AS city
     FROM users u
     WHERE ${authoritativeIsCustomerSql('u')}
       AND (u.full_name ILIKE $1 OR COALESCE(u.phone, '') ILIKE $1 OR u.account_id ILIKE $1 OR u.email ILIKE $1)
     ORDER BY u.created_at DESC
     LIMIT 25`,
    [search]
  );
  return res.rows;
}

export async function sendAdminInstruction(
  session: AdminSession,
  payload: {
    userId: string;
    roleTarget: 'customer' | 'merchant' | 'driver';
    eventType: string;
    title: string;
    body: string;
    restaurantId?: string;
    bookingId?: string;
  }
) {
  const userCheck = await query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 LIMIT 1`,
    [payload.userId]
  );
  if (!userCheck.rows[0]) {
    throw new Error('Selected recipient user does not exist.');
  }

  const inserted = await insertNotification({
    userId: payload.userId,
    bookingId: payload.bookingId || null,
    roleTarget: payload.roleTarget,
    eventType: payload.eventType.trim() || 'admin_instruction',
    title: payload.title.trim(),
    body: payload.body.trim(),
    data: {
      sentByAdmin: session.email,
      ...(payload.restaurantId ? { restaurantId: payload.restaurantId } : {}),
    },
  });

  await recordAuditLog({
    adminUserId: session.dbUserId,
    action: 'admin_send_notification',
    targetType: payload.roleTarget,
    targetId: payload.restaurantId || payload.userId,
    reason: payload.title.trim(),
    details: { eventType: payload.eventType, recipientUserId: payload.userId },
  });

  return inserted;
}

export async function getSettingsSnapshot() {
  const [vehiclesRes, deliveryCfgRes, zonesRes, parcelCfgRes, auditRes] = await Promise.all([
    query(
      `SELECT id, name, sinhala_tamil_sub, base_fare_lkr, per_km_rate_lkr, per_min_wait_lkr,
              parcel_handling_fee_lkr, eta_mins, surge_multiplier::float8 AS surge_multiplier,
              max_parcel_weight_kg::float8 AS max_parcel_weight_kg, supports_parcel
       FROM vehicle_types
       ORDER BY base_fare_lkr ASC`
    ),
    query(`SELECT * FROM delivery_config WHERE id = 'default' LIMIT 1`),
    query(
      `SELECT id, name, city, center_lat, center_lng, radius_km::float8 AS radius_km,
              base_fee_lkr, per_km_fee_lkr, is_active
       FROM delivery_zones
       ORDER BY city, name`
    ),
    query(`SELECT * FROM parcel_config WHERE id = 'default' LIMIT 1`),
    query(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.reason, a.details, a.created_at::text,
              COALESCE(u.full_name, 'Platform Admin') AS admin_name
       FROM admin_audit_logs a
       LEFT JOIN users u ON u.id = a.admin_user_id
       ORDER BY a.created_at DESC
       LIMIT 40`
    ),
  ]);

  return {
    vehicles: vehiclesRes.rows,
    deliveryConfig: deliveryCfgRes.rows[0] ?? null,
    deliveryZones: zonesRes.rows,
    parcelConfig: parcelCfgRes.rows[0] ?? null,
    auditLogs: auditRes.rows,
  };
}

export async function updateVehiclePricingAction(
  session: AdminSession,
  vehicleId: string,
  payload: {
    baseFareLKR?: number;
    perKmRateLKR?: number;
    perMinWaitLKR?: number;
    parcelHandlingFeeLKR?: number;
    surgeMultiplier?: number;
  }
) {
  const apiRes = await callGoDudeAdminApi(session, `/vehicles/${vehicleId}`, {
    method: 'PATCH',
    body: payload,
  });
  if (apiRes.reached && !apiRes.ok) {
    throw new Error(apiRes.error || 'Failed to update vehicle tier');
  }
  if (!apiRes.reached) {
    const upd = await query(
      `UPDATE vehicle_types
       SET base_fare_lkr = COALESCE($2, base_fare_lkr),
           per_km_rate_lkr = COALESCE($3, per_km_rate_lkr),
           per_min_wait_lkr = COALESCE($4, per_min_wait_lkr),
           parcel_handling_fee_lkr = COALESCE($5, parcel_handling_fee_lkr),
           surge_multiplier = COALESCE($6, surge_multiplier)
       WHERE id = $1
       RETURNING id`,
      [
        vehicleId,
        payload.baseFareLKR ?? null,
        payload.perKmRateLKR ?? null,
        payload.perMinWaitLKR ?? null,
        payload.parcelHandlingFeeLKR ?? null,
        payload.surgeMultiplier ?? null,
      ]
    );
    if (!upd.rows[0]) throw new Error('Vehicle tier not found');
  }
  await recordAuditLog({
    adminUserId: session.dbUserId,
    action: 'update_vehicle_pricing',
    targetType: 'vehicle_type',
    targetId: vehicleId,
    details: payload,
  });
  return { ok: true };
}

export async function updateDeliveryConfigAction(
  session: AdminSession,
  payload: {
    baseFeeLKR?: number;
    perKmFeeLKR?: number;
    minFeeLKR?: number;
    maxFeeLKR?: number;
    serviceFeeLKR?: number;
    savingsPct?: number;
  }
) {
  const apiRes = await callGoDudeAdminApi(session, `/delivery-config`, {
    method: 'PATCH',
    body: payload,
  });
  if (apiRes.reached && !apiRes.ok) {
    throw new Error(apiRes.error || 'Failed to update delivery configuration');
  }
  if (!apiRes.reached) {
    await query(
      `UPDATE delivery_config
       SET base_fee_lkr = COALESCE($1, base_fee_lkr),
           per_km_fee_lkr = COALESCE($2, per_km_fee_lkr),
           min_fee_lkr = COALESCE($3, min_fee_lkr),
           max_fee_lkr = COALESCE($4, max_fee_lkr),
           service_fee_lkr = COALESCE($5, service_fee_lkr),
           savings_pct = COALESCE($6, savings_pct),
           updated_at = NOW()
       WHERE id = 'default'`,
      [
        payload.baseFeeLKR ?? null,
        payload.perKmFeeLKR ?? null,
        payload.minFeeLKR ?? null,
        payload.maxFeeLKR ?? null,
        payload.serviceFeeLKR ?? null,
        payload.savingsPct ?? null,
      ]
    );
  }
  await recordAuditLog({
    adminUserId: session.dbUserId,
    action: 'update_delivery_config',
    targetType: 'delivery_config',
    targetId: 'default',
    details: payload,
  });
  return { ok: true };
}

export async function updateParcelConfigAction(
  session: AdminSession,
  payload: {
    platformCommissionPct?: number;
    fragileSurchargeLKR?: number;
    weightSurchargePerKgLKR?: number;
    minDeliveryFeeLKR?: number;
    requirePickupOtp?: boolean;
    requireDeliveryOtp?: boolean;
    savingsPct?: number;
  }
) {
  const apiRes = await callGoDudeAdminApi(session, `/parcel-config`, {
    method: 'PATCH',
    body: payload,
  });
  if (apiRes.reached && !apiRes.ok) {
    throw new Error(apiRes.error || 'Failed to update parcel config');
  }
  if (!apiRes.reached) {
    await query(
      `UPDATE parcel_config
       SET platform_commission_pct = COALESCE($1, platform_commission_pct),
           fragile_surcharge_lkr = COALESCE($2, fragile_surcharge_lkr),
           weight_surcharge_per_kg_lkr = COALESCE($3, weight_surcharge_per_kg_lkr),
           min_delivery_fee_lkr = COALESCE($4, min_delivery_fee_lkr),
           require_pickup_otp = COALESCE($5, require_pickup_otp),
           require_delivery_otp = COALESCE($6, require_delivery_otp),
           savings_pct = COALESCE($7, savings_pct),
           updated_at = NOW()
       WHERE id = 'default'`,
      [
        payload.platformCommissionPct ?? null,
        payload.fragileSurchargeLKR ?? null,
        payload.weightSurchargePerKgLKR ?? null,
        payload.minDeliveryFeeLKR ?? null,
        payload.requirePickupOtp ?? null,
        payload.requireDeliveryOtp ?? null,
        payload.savingsPct ?? null,
      ]
    );
  }
  await recordAuditLog({
    adminUserId: session.dbUserId,
    action: 'update_parcel_config',
    targetType: 'parcel_config',
    targetId: 'default',
    details: payload,
  });
  return { ok: true };
}
