import { AdminSession } from '../auth';
import { query, withTransaction } from '../db';
import { callGoDudeAdminApi } from '../godude-api';
import { buildSortClause, insertNotification, recordAuditLog } from './shared';

export interface RiderListRow {
  id: string;
  user_id: string;
  account_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  vehicle_type: string;
  vehicle_name: string;
  plate_number: string;
  license_number: string;
  is_verified: boolean;
  vehicle_approved: boolean;
  is_online: boolean;
  is_available: boolean;
  driver_state: string;
  operating_city: string;
  active_booking_id: string | null;
  active_service_type: string | null;
  rating: number;
  total_trips: number;
  earnings_lkr: number;
  last_location_at: string | null;
  created_at: string;
}

export async function listRiders(params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  vehicleType?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [];

  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(u.full_name ILIKE ${p} OR u.account_id ILIKE ${p} OR COALESCE(u.phone, '') ILIKE ${p} OR d.plate_number ILIKE ${p} OR d.license_number ILIKE ${p} OR d.vehicle_name ILIKE ${p} OR d.operating_city ILIKE ${p})`
    );
  }

  if (params.vehicleType && params.vehicleType !== 'all') {
    values.push(params.vehicleType);
    clauses.push(`d.vehicle_type = $${values.length}`);
  }

  switch (params.status) {
    case 'pending':
      clauses.push(`(d.is_verified = FALSE OR d.vehicle_approved = FALSE)`);
      break;
    case 'approved':
      clauses.push(`(d.is_verified = TRUE AND d.vehicle_approved = TRUE)`);
      break;
    case 'online':
      clauses.push(`d.is_online = TRUE`);
      break;
    case 'available':
      clauses.push(`(d.is_online = TRUE AND d.is_available = TRUE AND d.driver_state = 'AVAILABLE')`);
      break;
    case 'on_trip':
      clauses.push(
        `d.driver_state IN ('RESERVED', 'ASSIGNED', 'ON_RIDE', 'ON_FOOD_DELIVERY', 'ON_PARCEL_DELIVERY', 'ON_TRIP')`
      );
      break;
    case 'suspended':
      clauses.push(`d.driver_state = 'UNAVAILABLE'`);
      break;
    default:
      break;
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'd.created_at',
      full_name: 'u.full_name',
      rating: 'd.rating',
      total_trips: 'd.total_trips',
      driver_state: 'd.driver_state',
    },
    'd.updated_at'
  );

  const [countRes, summaryRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM drivers d JOIN users u ON u.id = d.user_id ${whereSql}`,
      values
    ),
    query<{
      total: string;
      approved: string;
      pending: string;
      online: string;
      suspended: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_verified = TRUE AND vehicle_approved = TRUE)::text AS approved,
         COUNT(*) FILTER (WHERE is_verified = FALSE OR vehicle_approved = FALSE)::text AS pending,
         COUNT(*) FILTER (WHERE is_online = TRUE)::text AS online,
         COUNT(*) FILTER (WHERE driver_state = 'UNAVAILABLE')::text AS suspended
       FROM drivers`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query<RiderListRow>(
    `SELECT
       d.id,
       d.user_id,
       u.account_id,
       u.full_name,
       u.phone,
       u.email,
       d.vehicle_type,
       d.vehicle_name,
       d.plate_number,
       d.license_number,
       d.is_verified,
       d.vehicle_approved,
       d.is_online,
       d.is_available,
       d.driver_state,
       d.operating_city,
       d.active_booking_id,
       d.active_service_type,
       d.rating::float8 AS rating,
       d.total_trips,
       COALESCE(SUM(b.rider_earnings_lkr) FILTER (WHERE b.status IN ('Completed', 'Delivered')), 0)::int AS earnings_lkr,
       d.last_location_at::text,
       d.created_at::text
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN bookings b ON b.driver_id = d.id
     ${whereSql}
     GROUP BY d.id, u.id
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
      approved: Number(s?.approved ?? 0),
      pending: Number(s?.pending ?? 0),
      online: Number(s?.online ?? 0),
      suspended: Number(s?.suspended ?? 0),
    },
  };
}

export async function getRiderDetail(driverId: string) {
  const [driverRes, tripsRes, dispatchesRes, notificationsRes, auditRes] = await Promise.all([
    query(
      `SELECT d.id, d.user_id, u.account_id, u.full_name, u.phone, u.email, u.role,
              u.member_since, u.avatar_url,
              d.vehicle_type, d.vehicle_name, d.plate_number, d.license_number,
              d.is_verified, d.vehicle_approved, d.is_online, d.is_available, d.driver_state,
              d.operating_city, d.current_lat, d.current_lng, d.current_speed_kmh,
              d.last_location_at::text, d.last_location_accuracy_m,
              d.active_booking_id, d.active_service_type, d.last_state_changed_at::text,
              d.rating::float8 AS rating, d.total_trips,
              d.created_at::text, d.updated_at::text,
              COALESCE((SELECT SUM(b.rider_earnings_lkr) FROM bookings b WHERE b.driver_id = d.id AND b.status IN ('Completed', 'Delivered')), 0)::int AS total_earnings_lkr,
              COALESCE((SELECT COUNT(*) FROM bookings b WHERE b.driver_id = d.id), 0)::int AS assigned_bookings_count
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = $1 LIMIT 1`,
      [driverId]
    ),
    query(
      `SELECT b.id, b.service_type, b.booking_mode, b.title, b.subtitle, b.status,
              b.pickup_address, b.destination_address, b.total_paid_lkr,
              b.rider_earnings_lkr, b.platform_commission_lkr, b.payment_method,
              b.estimated_distance_km::float8 AS distance_km,
              b.customer_rating, b.created_at::text, b.completed_at::text,
              c.full_name AS customer_name
       FROM bookings b
       JOIN users c ON c.id = b.customer_id
       WHERE b.driver_id = $1
       ORDER BY b.created_at DESC
       LIMIT 35`,
      [driverId]
    ),
    query(
      `SELECT rd.id, rd.booking_id, rd.distance_to_pickup_km::float8 AS distance_km,
              rd.status, rd.offered_at::text, rd.responded_at::text,
              b.service_type, b.title
       FROM ride_dispatches rd
       JOIN bookings b ON b.id = rd.booking_id
       WHERE rd.driver_id = $1
       ORDER BY rd.offered_at DESC
       LIMIT 25`,
      [driverId]
    ),
    query(
      `SELECT n.id, n.event_type, n.title, n.body, n.is_read, n.created_at::text
       FROM notifications n
       JOIN drivers d ON d.user_id = n.user_id
       WHERE d.id = $1
       ORDER BY n.created_at DESC
       LIMIT 20`,
      [driverId]
    ),
    query(
      `SELECT a.id, a.action, a.reason, a.details, a.created_at::text,
              COALESCE(u.full_name, 'System Admin') AS admin_name
       FROM admin_audit_logs a
       LEFT JOIN users u ON u.id = a.admin_user_id
       WHERE a.target_type = 'driver' AND a.target_id = $1
       ORDER BY a.created_at DESC
       LIMIT 25`,
      [driverId]
    ),
  ]);

  if (!driverRes.rows[0]) return null;
  return {
    rider: driverRes.rows[0],
    trips: tripsRes.rows,
    dispatches: dispatchesRes.rows,
    notifications: notificationsRes.rows,
    auditHistory: auditRes.rows,
  };
}

export async function reviewRiderAction(
  session: AdminSession,
  driverId: string,
  payload: {
    action: 'approve' | 'reject' | 'suspend' | 'request_info' | 'restore_available' | 'recalculate';
    reason?: string;
  }
) {
  const driverLookup = await query<{
    id: string;
    user_id: string;
    full_name: string;
    plate_number: string;
    active_booking_id: string | null;
    driver_state: string;
  }>(
    `SELECT d.id, d.user_id, u.full_name, d.plate_number, d.active_booking_id, d.driver_state
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     WHERE d.id = $1 LIMIT 1`,
    [driverId]
  );
  const existing = driverLookup.rows[0];
  if (!existing) {
    throw new Error('Rider record not found');
  }

  if (payload.action === 'recalculate') {
    const apiRes = await callGoDudeAdminApi(session, `/drivers/${driverId}/recalculate-availability`, {
      method: 'POST',
    });
    await recordAuditLog({
      adminUserId: session.dbUserId,
      action: 'driver_recalculate_availability',
      targetType: 'driver',
      targetId: driverId,
      reason: payload.reason || 'Admin recalculated rider availability',
    });
    return { apiSynced: apiRes.ok };
  }

  if (payload.action === 'suspend' || payload.action === 'restore_available') {
    const body =
      payload.action === 'suspend'
        ? { isOnline: false, isAvailable: false, driverState: 'UNAVAILABLE' }
        : { isOnline: true, isAvailable: true, driverState: 'AVAILABLE' };
    const apiRes = await callGoDudeAdminApi(session, `/drivers/${driverId}/toggle`, {
      method: 'PATCH',
      body,
    });
    if (apiRes.reached && !apiRes.ok) {
      throw new Error(apiRes.error || 'Failed to update rider availability');
    }

    if (!apiRes.reached) {
      // Enforce same GoDude active-assignment protection locally
      const activeRes = await query<{ id: string; service_type: string }>(
        `SELECT id, service_type FROM bookings WHERE driver_id = $1 AND status IN ('Rider Assigned', 'Arrived', 'On the Way') LIMIT 1`,
        [driverId]
      );
      if (activeRes.rows[0]) {
        throw new Error(
          `Driver has an active ${activeRes.rows[0].service_type} assignment (${activeRes.rows[0].id}) and cannot be toggled right now.`
        );
      }
      await query(
        `UPDATE drivers
         SET is_online = $2, is_available = $3, driver_state = $4, updated_at = NOW(), last_state_changed_at = NOW()
         WHERE id = $1`,
        [driverId, body.isOnline, body.isAvailable, body.driverState]
      );
    }

    const msg =
      payload.reason?.trim() ||
      (payload.action === 'suspend'
        ? 'Your driver account was placed offline/unavailable by GoDude Administration.'
        : 'Your driver account is approved and marked Available for dispatch.');

    await insertNotification({
      userId: existing.user_id,
      roleTarget: 'driver',
      eventType: payload.action === 'suspend' ? 'driver_suspended' : 'driver_reinstated',
      title:
        payload.action === 'suspend'
          ? 'Driver Status Set to Unavailable'
          : 'Driver Availability Restored',
      body: msg,
      data: { driverId, plateNumber: existing.plate_number, action: payload.action },
    });

    await recordAuditLog({
      adminUserId: session.dbUserId,
      action: `driver_${payload.action}`,
      targetType: 'driver',
      targetId: driverId,
      reason: msg,
    });

    return { ok: true };
  }

  if (payload.action === 'approve' || payload.action === 'reject') {
    if (payload.action === 'reject' && !payload.reason?.trim()) {
      throw new Error('Rejection reason is required.');
    }

    const approvalStatus = payload.action === 'approve' ? 'approved' : 'rejected';
    const apiRes = await callGoDudeAdminApi(session, `/drivers/${driverId}/approval`, {
      method: 'PATCH',
      body: {
        approvalStatus,
        reason: payload.reason?.trim() || undefined,
      },
    });
    if (apiRes.reached && !apiRes.ok) {
      throw new Error(apiRes.error || 'Backend rejected rider approval update');
    }

    return withTransaction(async (client) => {
      if (!apiRes.reached) {
        if (payload.action === 'approve') {
          await client.query(
            `UPDATE drivers
             SET is_verified = TRUE, vehicle_approved = TRUE,
                 driver_state = CASE WHEN driver_state = 'UNAVAILABLE' AND is_online THEN 'AVAILABLE' WHEN driver_state = 'UNAVAILABLE' AND NOT is_online THEN 'OFFLINE' ELSE driver_state END,
                 updated_at = NOW()
             WHERE id = $1`,
            [driverId]
          );
        } else {
          await client.query(
            `UPDATE drivers
             SET is_verified = FALSE, vehicle_approved = FALSE, is_online = FALSE,
                 is_available = FALSE, driver_state = 'UNAVAILABLE', updated_at = NOW(), last_state_changed_at = NOW()
             WHERE id = $1`,
            [driverId]
          );
        }
      }

      if (payload.action === 'approve') {
        await insertNotification(
          {
            userId: existing.user_id,
            roleTarget: 'driver',
            eventType: 'driver_verification_approved',
            title: 'Rider Verification Approved',
            body:
              payload.reason?.trim() ||
              `Your vehicle (${existing.plate_number}) and driver verification have been approved. You can now go online and accept rides & deliveries.`,
            data: { driverId, plateNumber: existing.plate_number, approved: true },
          },
          client
        );
      } else {
        await insertNotification(
          {
            userId: existing.user_id,
            roleTarget: 'driver',
            eventType: 'driver_verification_rejected',
            title: 'Rider Verification Requires Action',
            body: payload.reason!.trim(),
            data: { driverId, plateNumber: existing.plate_number, approved: false },
          },
          client
        );
      }

      await recordAuditLog(
        {
          adminUserId: session.dbUserId,
          action: `driver_${payload.action}`,
          targetType: 'driver',
          targetId: driverId,
          reason: payload.reason?.trim() || '',
          details: { approvalStatus, backendSynced: apiRes.ok },
        },
        client
      );

      return { ok: true, backendSynced: apiRes.ok };
    });
  }

  return withTransaction(async (client) => {
    if (payload.action === 'request_info') {
      if (!payload.reason?.trim()) {
        throw new Error('Instruction message is required.');
      }
      await insertNotification(
        {
          userId: existing.user_id,
          roleTarget: 'driver',
          eventType: 'driver_verification_feedback',
          title: 'Verification Instructions from GoDude Admin',
          body: payload.reason.trim(),
          data: { driverId, plateNumber: existing.plate_number },
        },
        client
      );
    }

    await recordAuditLog(
      {
        adminUserId: session.dbUserId,
        action: `driver_${payload.action}`,
        targetType: 'driver',
        targetId: driverId,
        reason: payload.reason?.trim() || '',
      },
      client
    );

    return { ok: true };
  });
}
