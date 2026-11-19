import { query } from '../db';
import {
  authoritativeIsCustomerSql,
  deriveEffectiveRoles,
  EffectiveRoleTag,
  hasCustomerActivitySql,
  hasDriverProfileSql,
  hasRestaurantProfileSql,
} from './shared';

export interface OverviewStats {
  kpis: {
    totalCustomers: number;
    totalPlatformUsers: number;
    dualRoleUsers: number;
    totalRiders: number;
    onlineRiders: number;
    availableRiders: number;
    onTripRiders: number;
    unverifiedRiders: number;
    totalRestaurants: number;
    openRestaurants: number;
    pendingRestaurants: number;
    suspendedRestaurants: number;
    rejectedRestaurants: number;
    totalRides: number;
    activeRides: number;
    completedRides: number;
    cancelledRides: number;
    totalFoodOrders: number;
    activeFoodOrders: number;
    completedFoodOrders: number;
    cancelledFoodOrders: number;
    totalParcels: number;
    activeParcels: number;
    completedParcels: number;
    failedOrReturnedParcels: number;
    totalTransactions: number;
    completedRevenueLKR: number;
    verifiedRevenueLKR: number;
    inFlightPaidLKR: number;
    refundedVolumeLKR: number;
    platformCommissionLKR: number;
    riderEarningsLKR: number;
    savingsCreditedLKR: number;
  };
  fleetBreakdown: {
    state: string;
    count: number;
  }[];
  dailyTrends: {
    day: string;
    label: string;
    rides: number;
    food: number;
    parcel: number;
    revenueLKR: number;
  }[];
  serviceDistribution: {
    serviceType: string;
    total: number;
    completed: number;
    active: number;
    cancelled: number;
    revenueLKR: number;
  }[];
  pendingRestaurantsList: {
    id: string;
    name: string;
    city: string;
    address: string;
    approval_status: string;
    contact_phone: string;
    owner_name: string | null;
    owner_phone: string | null;
    created_at: string;
  }[];
  pendingRidersList: {
    id: string;
    full_name: string;
    phone: string;
    vehicle_type: string;
    vehicle_name: string;
    plate_number: string;
    is_verified: boolean;
    vehicle_approved: boolean;
    created_at: string;
  }[];
  recentBookings: {
    id: string;
    service_type: string;
    title: string;
    status: string;
    total_paid_lkr: number;
    payment_method: string;
    customer_id: string;
    customer_account_id: string;
    customer_name: string;
    created_at: string;
  }[];
  recentRegistrations: {
    id: string;
    account_id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: string;
    effective_roles: EffectiveRoleTag[];
    onboarding_pending_role: 'driver' | 'merchant' | null;
    created_at: string;
  }[];
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const isCustSql = authoritativeIsCustomerSql('u');
  const hasDrvSql = hasDriverProfileSql('u');
  const hasRestSql = hasRestaurantProfileSql('u');
  const hasActSql = hasCustomerActivitySql('u');

  const [
    usersRes,
    driversRes,
    fleetStatesRes,
    restaurantsRes,
    bookingsSummaryRes,
    txSummaryRes,
    savingsRes,
    trendsRes,
    serviceDistRes,
    pendingRestRes,
    pendingRidersRes,
    recentBookingsRes,
    recentUsersRes,
  ] = await Promise.all([
    query<{ total_customers: string; total_platform_users: string; dual_role_users: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE ${isCustSql})::text AS total_customers,
         COUNT(*) FILTER (WHERE u.role != 'admin')::text AS total_platform_users,
         COUNT(*) FILTER (WHERE ${isCustSql} AND (${hasDrvSql} OR ${hasRestSql}))::text AS dual_role_users
       FROM users u`
    ),
    query<{
      total: string;
      online: string;
      available: string;
      on_trip: string;
      unverified: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE d.is_online = TRUE)::text AS online,
         COUNT(*) FILTER (WHERE d.is_online = TRUE AND d.is_available = TRUE AND d.driver_state = 'AVAILABLE')::text AS available,
         COUNT(*) FILTER (WHERE d.driver_state IN ('RESERVED', 'ASSIGNED', 'ON_RIDE', 'ON_FOOD_DELIVERY', 'ON_PARCEL_DELIVERY', 'ON_TRIP'))::text AS on_trip,
         COUNT(*) FILTER (WHERE d.is_verified = FALSE OR d.vehicle_approved = FALSE)::text AS unverified
       FROM drivers d
       JOIN users u ON u.id = d.user_id`
    ),
    query<{ state: string; count: string }>(
      `SELECT d.driver_state AS state, COUNT(*)::text AS count
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       GROUP BY d.driver_state
       ORDER BY COUNT(*) DESC`
    ),
    query<{
      total: string;
      open_count: string;
      pending_count: string;
      suspended_count: string;
      rejected_count: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE is_open = TRUE AND approval_status = 'approved')::text AS open_count,
         COUNT(*) FILTER (WHERE approval_status = 'pending')::text AS pending_count,
         COUNT(*) FILTER (WHERE approval_status = 'suspended')::text AS suspended_count,
         COUNT(*) FILTER (WHERE approval_status = 'rejected')::text AS rejected_count
       FROM restaurants`
    ),
    query<{
      total_rides: string;
      active_rides: string;
      completed_rides: string;
      cancelled_rides: string;
      total_food: string;
      active_food: string;
      completed_food: string;
      cancelled_food: string;
      total_parcels: string;
      active_parcels: string;
      completed_parcels: string;
      failed_parcels: string;
      completed_revenue_lkr: string;
      commission_lkr: string;
      rider_earnings_lkr: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE service_type IN ('Ride Booking', 'Flexible Ride'))::text AS total_rides,
         COUNT(*) FILTER (WHERE service_type IN ('Ride Booking', 'Flexible Ride') AND status IN ('Searching', 'Rider Assigned', 'Arrived', 'On the Way'))::text AS active_rides,
         COUNT(*) FILTER (WHERE service_type IN ('Ride Booking', 'Flexible Ride') AND status = 'Completed')::text AS completed_rides,
         COUNT(*) FILTER (WHERE service_type IN ('Ride Booking', 'Flexible Ride') AND status = 'Cancelled')::text AS cancelled_rides,
         COUNT(*) FILTER (WHERE service_type = 'Food Delivery')::text AS total_food,
         COUNT(*) FILTER (WHERE service_type = 'Food Delivery' AND status IN ('Searching', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Rider Assigned', 'Arrived', 'On the Way'))::text AS active_food,
         COUNT(*) FILTER (WHERE service_type = 'Food Delivery' AND status IN ('Delivered', 'Completed'))::text AS completed_food,
         COUNT(*) FILTER (WHERE service_type = 'Food Delivery' AND status = 'Cancelled')::text AS cancelled_food,
         COUNT(*) FILTER (WHERE service_type = 'Parcel Delivery')::text AS total_parcels,
         COUNT(*) FILTER (WHERE service_type = 'Parcel Delivery' AND status IN ('Searching', 'Rider Assigned', 'Arrived', 'On the Way', 'Return Initiated'))::text AS active_parcels,
         COUNT(*) FILTER (WHERE service_type = 'Parcel Delivery' AND status IN ('Delivered', 'Completed'))::text AS completed_parcels,
         COUNT(*) FILTER (WHERE service_type = 'Parcel Delivery' AND status IN ('Cancelled', 'Delivery Failed', 'Returned to Sender'))::text AS failed_parcels,
         COALESCE(SUM(total_paid_lkr) FILTER (WHERE status IN ('Completed', 'Delivered')), 0)::text AS completed_revenue_lkr,
         COALESCE(SUM(platform_commission_lkr) FILTER (WHERE status IN ('Completed', 'Delivered')), 0)::text AS commission_lkr,
         COALESCE(SUM(rider_earnings_lkr) FILTER (WHERE status IN ('Completed', 'Delivered')), 0)::text AS rider_earnings_lkr
       FROM bookings`
    ),
    query<{
      total_tx: string;
      verified_revenue_lkr: string;
      in_flight_paid_lkr: string;
      refunded_lkr: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_tx,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified'), 0)::text AS verified_revenue_lkr,
         COALESCE(SUM(pt.amount_lkr) FILTER (WHERE pt.status = 'verified' AND b.status NOT IN ('Completed', 'Delivered', 'Cancelled')), 0)::text AS in_flight_paid_lkr,
         COALESCE(SUM(CASE WHEN pt.refund_amount_lkr > 0 THEN pt.refund_amount_lkr WHEN pt.status = 'refunded' THEN pt.amount_lkr ELSE 0 END), 0)::text AS refunded_lkr
       FROM payment_transactions pt
       JOIN bookings b ON b.id = pt.booking_id`
    ),
    query<{ credited_lkr: string }>(
      `SELECT COALESCE(SUM(amount_lkr) FILTER (WHERE type IN ('credit_ride', 'credit_order')), 0)::text AS credited_lkr
       FROM savings_transactions`
    ),
    query<{
      day: string;
      label: string;
      rides: string;
      food: string;
      parcel: string;
      revenue_lkr: string;
    }>(
      `WITH days AS (
         SELECT generate_series(
           (NOW() AT TIME ZONE 'Asia/Colombo')::date - INTERVAL '13 days',
           (NOW() AT TIME ZONE 'Asia/Colombo')::date,
           INTERVAL '1 day'
         )::date AS d
       )
       SELECT
         days.d::text AS day,
         TO_CHAR(days.d, 'Mon DD') AS label,
         COUNT(b.id) FILTER (WHERE b.service_type IN ('Ride Booking', 'Flexible Ride'))::text AS rides,
         COUNT(b.id) FILTER (WHERE b.service_type = 'Food Delivery')::text AS food,
         COUNT(b.id) FILTER (WHERE b.service_type = 'Parcel Delivery')::text AS parcel,
         COALESCE(SUM(b.total_paid_lkr) FILTER (WHERE b.status IN ('Completed', 'Delivered')), 0)::text AS revenue_lkr
       FROM days
       LEFT JOIN bookings b
         ON (b.created_at AT TIME ZONE 'Asia/Colombo')::date = days.d
       GROUP BY days.d
       ORDER BY days.d ASC`
    ),
    query<{
      service_type: string;
      total: string;
      completed: string;
      active: string;
      cancelled: string;
      revenue_lkr: string;
    }>(
      `SELECT
         service_type,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status IN ('Completed', 'Delivered'))::text AS completed,
         COUNT(*) FILTER (WHERE status IN ('Searching', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Rider Assigned', 'Arrived', 'On the Way', 'Return Initiated'))::text AS active,
         COUNT(*) FILTER (WHERE status IN ('Cancelled', 'Delivery Failed', 'Returned to Sender'))::text AS cancelled,
         COALESCE(SUM(total_paid_lkr) FILTER (WHERE status IN ('Completed', 'Delivered')), 0)::text AS revenue_lkr
       FROM bookings
       GROUP BY service_type
       ORDER BY COUNT(*) DESC`
    ),
    query<{
      id: string;
      name: string;
      city: string;
      address: string;
      approval_status: string;
      contact_phone: string;
      owner_name: string | null;
      owner_phone: string | null;
      created_at: string;
    }>(
      `SELECT r.id, r.name, r.city, r.address, r.approval_status, r.contact_phone,
              u.full_name AS owner_name, u.phone AS owner_phone, r.created_at::text
       FROM restaurants r
       LEFT JOIN users u ON u.id = r.owner_user_id
       WHERE r.approval_status = 'pending'
       ORDER BY r.created_at DESC
       LIMIT 8`
    ),
    query<{
      id: string;
      full_name: string;
      phone: string;
      vehicle_type: string;
      vehicle_name: string;
      plate_number: string;
      is_verified: boolean;
      vehicle_approved: boolean;
      created_at: string;
    }>(
      `SELECT d.id, u.full_name, COALESCE(u.phone, '') AS phone,
              d.vehicle_type, d.vehicle_name, d.plate_number,
              d.is_verified, d.vehicle_approved, d.created_at::text
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE d.is_verified = FALSE OR d.vehicle_approved = FALSE
       ORDER BY d.created_at DESC
       LIMIT 8`
    ),
    query<{
      id: string;
      service_type: string;
      title: string;
      status: string;
      total_paid_lkr: number;
      payment_method: string;
      customer_id: string;
      customer_account_id: string;
      customer_name: string;
      created_at: string;
    }>(
      `SELECT b.id, b.service_type, b.title, b.status, b.total_paid_lkr, b.payment_method,
              u.id AS customer_id, u.account_id AS customer_account_id,
              u.full_name AS customer_name, b.created_at::text
       FROM bookings b
       JOIN users u ON u.id = b.customer_id
       ORDER BY b.created_at DESC
       LIMIT 10`
    ),
    query<{
      id: string;
      account_id: string;
      full_name: string;
      email: string;
      phone: string | null;
      role: string;
      has_driver_profile: boolean;
      has_restaurant_profile: boolean;
      has_customer_activity: boolean;
      created_at: string;
    }>(
      `SELECT u.id, u.account_id, u.full_name, u.email, u.phone, u.role,
              ${hasDrvSql} AS has_driver_profile,
              ${hasRestSql} AS has_restaurant_profile,
              ${hasActSql} AS has_customer_activity,
              u.created_at::text
       FROM users u
       WHERE u.role != 'admin'
       ORDER BY u.created_at DESC
       LIMIT 10`
    ),
  ]);

  const u = usersRes.rows[0];
  const d = driversRes.rows[0];
  const r = restaurantsRes.rows[0];
  const b = bookingsSummaryRes.rows[0];
  const t = txSummaryRes.rows[0];

  return {
    kpis: {
      totalCustomers: Number(u?.total_customers ?? 0),
      totalPlatformUsers: Number(u?.total_platform_users ?? 0),
      dualRoleUsers: Number(u?.dual_role_users ?? 0),
      totalRiders: Number(d?.total ?? 0),
      onlineRiders: Number(d?.online ?? 0),
      availableRiders: Number(d?.available ?? 0),
      onTripRiders: Number(d?.on_trip ?? 0),
      unverifiedRiders: Number(d?.unverified ?? 0),
      totalRestaurants: Number(r?.total ?? 0),
      openRestaurants: Number(r?.open_count ?? 0),
      pendingRestaurants: Number(r?.pending_count ?? 0),
      suspendedRestaurants: Number(r?.suspended_count ?? 0),
      rejectedRestaurants: Number(r?.rejected_count ?? 0),
      totalRides: Number(b?.total_rides ?? 0),
      activeRides: Number(b?.active_rides ?? 0),
      completedRides: Number(b?.completed_rides ?? 0),
      cancelledRides: Number(b?.cancelled_rides ?? 0),
      totalFoodOrders: Number(b?.total_food ?? 0),
      activeFoodOrders: Number(b?.active_food ?? 0),
      completedFoodOrders: Number(b?.completed_food ?? 0),
      cancelledFoodOrders: Number(b?.cancelled_food ?? 0),
      totalParcels: Number(b?.total_parcels ?? 0),
      activeParcels: Number(b?.active_parcels ?? 0),
      completedParcels: Number(b?.completed_parcels ?? 0),
      failedOrReturnedParcels: Number(b?.failed_parcels ?? 0),
      totalTransactions: Number(t?.total_tx ?? 0),
      completedRevenueLKR: Number(b?.completed_revenue_lkr ?? 0),
      verifiedRevenueLKR: Number(t?.verified_revenue_lkr ?? 0),
      inFlightPaidLKR: Number(t?.in_flight_paid_lkr ?? 0),
      refundedVolumeLKR: Number(t?.refunded_lkr ?? 0),
      platformCommissionLKR: Number(b?.commission_lkr ?? 0),
      riderEarningsLKR: Number(b?.rider_earnings_lkr ?? 0),
      savingsCreditedLKR: Number(savingsRes.rows[0]?.credited_lkr ?? 0),
    },
    fleetBreakdown: fleetStatesRes.rows.map((row) => ({
      state: row.state,
      count: Number(row.count),
    })),
    dailyTrends: trendsRes.rows.map((row) => ({
      day: row.day,
      label: row.label,
      rides: Number(row.rides),
      food: Number(row.food),
      parcel: Number(row.parcel),
      revenueLKR: Number(row.revenue_lkr),
    })),
    serviceDistribution: serviceDistRes.rows.map((row) => ({
      serviceType: row.service_type,
      total: Number(row.total),
      completed: Number(row.completed),
      active: Number(row.active),
      cancelled: Number(row.cancelled),
      revenueLKR: Number(row.revenue_lkr),
    })),
    pendingRestaurantsList: pendingRestRes.rows,
    pendingRidersList: pendingRidersRes.rows,
    recentBookings: recentBookingsRes.rows,
    recentRegistrations: recentUsersRes.rows.map((row) => {
      const derived = deriveEffectiveRoles({
        rawRole: row.role,
        hasDriverProfile: Boolean(row.has_driver_profile),
        hasRestaurantProfile: Boolean(row.has_restaurant_profile),
        hasCustomerActivity: Boolean(row.has_customer_activity),
      });
      return {
        id: row.id,
        account_id: row.account_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        effective_roles: derived.roles,
        onboarding_pending_role: derived.onboardingPendingRole,
        created_at: row.created_at,
      };
    }),
  };
}
