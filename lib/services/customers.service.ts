import { query } from '../db';
import {
  authoritativeIsCustomerSql,
  buildSortClause,
  deriveEffectiveRoles,
  EffectiveRoleTag,
  hasCustomerActivitySql,
  hasDriverProfileSql,
  hasRestaurantProfileSql,
} from './shared';

export interface CustomerListRow {
  id: string;
  account_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  effective_roles: EffectiveRoleTag[];
  onboarding_pending_role: 'driver' | 'merchant' | null;
  has_driver_profile: boolean;
  driver_id: string | null;
  driver_plate: string | null;
  has_restaurant_profile: boolean;
  restaurants_owned_count: number;
  rating: number;
  total_ratings: number;
  member_since: string;
  notifications_enabled: boolean;
  location_consent_enabled: boolean;
  rides_count: number;
  food_orders_count: number;
  parcels_count: number;
  total_spent_lkr: number;
  created_at: string;
}

export async function listCustomers(params: {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}) {
  const offset = (params.page - 1) * params.pageSize;
  const values: unknown[] = [];
  const clauses: string[] = [`u.role != 'admin'`];

  const isCustSql = authoritativeIsCustomerSql('u');
  const hasDrvSql = hasDriverProfileSql('u');
  const hasRestSql = hasRestaurantProfileSql('u');
  const hasActSql = hasCustomerActivitySql('u');

  switch (params.role) {
    case 'customer':
      clauses.push(isCustSql);
      break;
    case 'driver':
      clauses.push(hasDrvSql);
      break;
    case 'merchant':
      clauses.push(hasRestSql);
      break;
    case 'dual':
      clauses.push(`(${isCustSql} AND (${hasDrvSql} OR ${hasRestSql}))`);
      break;
    case 'all':
    case undefined:
    case '':
      break;
    default:
      values.push(params.role);
      clauses.push(`u.role = $${values.length}`);
      break;
  }

  if (params.search) {
    values.push(`%${params.search}%`);
    const p = `$${values.length}`;
    clauses.push(
      `(u.full_name ILIKE ${p} OR u.account_id ILIKE ${p} OR COALESCE(u.phone, '') ILIKE ${p} OR u.email ILIKE ${p})`
    );
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = buildSortClause(
    params.sort,
    params.order ?? 'DESC',
    {
      created_at: 'u.created_at',
      full_name: 'u.full_name',
      rating: 'u.rating',
      account_id: 'u.account_id',
    },
    'u.created_at'
  );

  const [countRes, summaryRes] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users u ${whereSql}`, values),
    query<{
      customers: string;
      all_users: string;
      drivers: string;
      merchants: string;
      dual: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE ${isCustSql})::text AS customers,
         COUNT(*) FILTER (WHERE u.role != 'admin')::text AS all_users,
         COUNT(*) FILTER (WHERE u.role != 'admin' AND ${hasDrvSql})::text AS drivers,
         COUNT(*) FILTER (WHERE u.role != 'admin' AND ${hasRestSql})::text AS merchants,
         COUNT(*) FILTER (WHERE ${isCustSql} AND (${hasDrvSql} OR ${hasRestSql}))::text AS dual
       FROM users u`
    ),
  ]);

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query<
    Omit<CustomerListRow, 'effective_roles' | 'onboarding_pending_role'> & {
      has_customer_activity: boolean;
    }
  >(
    `SELECT
       u.id,
       u.account_id,
       u.full_name,
       u.email,
       u.phone,
       u.role,
       ${hasDrvSql} AS has_driver_profile,
       d.id AS driver_id,
       d.plate_number AS driver_plate,
       ${hasRestSql} AS has_restaurant_profile,
       (SELECT COUNT(*)::int FROM restaurants r_o WHERE r_o.owner_user_id = u.id) AS restaurants_owned_count,
       ${hasActSql} AS has_customer_activity,
       u.rating::float8 AS rating,
       u.total_ratings,
       u.member_since,
       u.notifications_enabled,
       u.location_consent_enabled,
       u.created_at::text,
       COUNT(b.id) FILTER (WHERE b.service_type IN ('Ride Booking', 'Flexible Ride'))::int AS rides_count,
       COUNT(b.id) FILTER (WHERE b.service_type = 'Food Delivery')::int AS food_orders_count,
       COUNT(b.id) FILTER (WHERE b.service_type = 'Parcel Delivery')::int AS parcels_count,
       COALESCE(SUM(b.total_paid_lkr) FILTER (WHERE b.status IN ('Completed', 'Delivered')), 0)::int AS total_spent_lkr
     FROM users u
     LEFT JOIN drivers d ON d.user_id = u.id
     LEFT JOIN bookings b ON b.customer_id = u.id
     ${whereSql}
     GROUP BY u.id, d.id
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const items: CustomerListRow[] = rowsRes.rows.map((row) => {
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
      has_driver_profile: Boolean(row.has_driver_profile),
      driver_id: row.driver_id,
      driver_plate: row.driver_plate,
      has_restaurant_profile: Boolean(row.has_restaurant_profile),
      restaurants_owned_count: Number(row.restaurants_owned_count ?? 0),
      rating: row.rating,
      total_ratings: row.total_ratings,
      member_since: row.member_since,
      notifications_enabled: row.notifications_enabled,
      location_consent_enabled: row.location_consent_enabled,
      rides_count: row.rides_count,
      food_orders_count: row.food_orders_count,
      parcels_count: row.parcels_count,
      total_spent_lkr: row.total_spent_lkr,
      created_at: row.created_at,
    };
  });

  const s = summaryRes.rows[0];
  return {
    items,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
    counts: {
      customers: Number(s?.customers ?? 0),
      all: Number(s?.all_users ?? 0),
      drivers: Number(s?.drivers ?? 0),
      merchants: Number(s?.merchants ?? 0),
      dual: Number(s?.dual ?? 0),
    },
  };
}

export async function getCustomerDetail(id: string) {
  const [
    userRes,
    summaryRes,
    driverRes,
    restaurantsRes,
    addressesRes,
    banksRes,
    bookingsRes,
    paymentsRes,
    savingsRes,
    notificationsRes,
  ] = await Promise.all([
    query<{
      id: string;
      account_id: string;
      full_name: string;
      email: string;
      phone: string | null;
      role: string;
      rating: number;
      total_ratings: number;
      selected_location_id: string;
      last_withdrawal_month: string | null;
      notifications_enabled: boolean;
      location_consent_enabled: boolean;
      member_since: string;
      avatar_url: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, account_id, full_name, email, phone, role, rating::float8 AS rating,
              total_ratings, selected_location_id, last_withdrawal_month,
              notifications_enabled, location_consent_enabled, member_since,
              avatar_url, created_at::text, updated_at::text
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    ),
    query<{
      rides_count: number;
      food_orders_count: number;
      parcels_count: number;
      total_bookings_count: number;
      completed_spend_lkr: number;
      refunded_total_lkr: number;
      payments_count: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FILTER (WHERE service_type IN ('Ride Booking', 'Flexible Ride')) FROM bookings WHERE customer_id = $1)::int AS rides_count,
         (SELECT COUNT(*) FILTER (WHERE service_type = 'Food Delivery') FROM bookings WHERE customer_id = $1)::int AS food_orders_count,
         (SELECT COUNT(*) FILTER (WHERE service_type = 'Parcel Delivery') FROM bookings WHERE customer_id = $1)::int AS parcels_count,
         (SELECT COUNT(*) FROM bookings WHERE customer_id = $1)::int AS total_bookings_count,
         (SELECT COALESCE(SUM(total_paid_lkr) FILTER (WHERE status IN ('Completed', 'Delivered')), 0) FROM bookings WHERE customer_id = $1)::int AS completed_spend_lkr,
         (SELECT COALESCE(SUM(CASE WHEN refund_amount_lkr > 0 THEN refund_amount_lkr WHEN status = 'refunded' THEN amount_lkr ELSE 0 END), 0) FROM payment_transactions WHERE user_id = $1)::int AS refunded_total_lkr,
         (SELECT COUNT(*) FROM payment_transactions WHERE user_id = $1)::int AS payments_count`,
      [id]
    ),
    query(
      `SELECT d.id, d.vehicle_type, d.vehicle_name, d.plate_number, d.license_number,
              d.is_verified, d.vehicle_approved, d.is_online, d.is_available, d.driver_state,
              d.operating_city, d.rating::float8 AS rating, d.total_trips,
              COALESCE((SELECT SUM(b.rider_earnings_lkr) FROM bookings b WHERE b.driver_id = d.id AND b.status IN ('Completed', 'Delivered')), 0)::int AS total_earnings_lkr,
              d.created_at::text
       FROM drivers d
       WHERE d.user_id = $1 LIMIT 1`,
      [id]
    ),
    query(
      `SELECT id, name, city, approval_status, store_status, is_open, rating::float8 AS rating, created_at::text
       FROM restaurants
       WHERE owner_user_id = $1
       ORDER BY created_at DESC`,
      [id]
    ),
    query(
      `SELECT id, label, address_line, city, landmark, lat, lng, created_at::text
       FROM saved_addresses WHERE user_id = $1 ORDER BY created_at DESC`,
      [id]
    ),
    query(
      `SELECT id, bank_name, branch_name, account_holder, account_number_masked, is_verified, created_at::text
       FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
      [id]
    ),
    query(
      `SELECT b.id, b.service_type, b.booking_mode, b.title, b.subtitle, b.status,
              b.payment_method, b.payment_status, b.pickup_address, b.destination_address,
              b.total_paid_lkr, b.savings_earned_lkr, b.created_at::text,
              r.name AS restaurant_name
       FROM bookings b
       LEFT JOIN restaurants r ON r.id = b.restaurant_id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC
       LIMIT 100`,
      [id]
    ),
    query(
      `SELECT id, booking_id, method, amount_lkr, currency, status, gateway_ref,
              refund_amount_lkr, refunded_at::text, created_at::text
       FROM payment_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    ),
    query(
      `SELECT id, type, title, reference_id, tx_date, eligible_base_amount_lkr,
              amount_lkr, status, recipient_details, created_at::text
       FROM savings_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [id]
    ),
    query(
      `SELECT id, role_target, event_type, title, body, is_read, created_at::text
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    ),
  ]);

  const user = userRes.rows[0];
  if (!user) return null;

  // Check if any other distinct account shares the same non-empty email (surfaces potential duplicate test accounts safely)
  const relatedByEmailRes = user.email?.trim()
    ? await query<{
        id: string;
        account_id: string;
        full_name: string;
        phone: string | null;
        role: string;
      }>(
        `SELECT id, account_id, full_name, phone, role
         FROM users
         WHERE id <> $1 AND email <> '' AND LOWER(email) = LOWER($2)
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id, user.email.trim()]
      )
    : { rows: [] };

  const summary = summaryRes.rows[0] ?? {
    rides_count: 0,
    food_orders_count: 0,
    parcels_count: 0,
    total_bookings_count: 0,
    completed_spend_lkr: 0,
    refunded_total_lkr: 0,
    payments_count: 0,
  };

  const derived = deriveEffectiveRoles({
    rawRole: user.role,
    hasDriverProfile: Boolean(driverRes.rows[0]),
    hasRestaurantProfile: restaurantsRes.rows.length > 0,
    hasCustomerActivity:
      summary.total_bookings_count > 0 ||
      summary.payments_count > 0 ||
      savingsRes.rows.length > 0,
  });

  return {
    customer: {
      ...user,
      effective_roles: derived.roles,
      onboarding_pending_role: derived.onboardingPendingRole,
      rides_count: summary.rides_count,
      food_orders_count: summary.food_orders_count,
      parcels_count: summary.parcels_count,
      total_spent_lkr: summary.completed_spend_lkr,
    },
    summary,
    driverProfile: driverRes.rows[0] ?? null,
    ownedRestaurants: restaurantsRes.rows,
    relatedAccountsByEmail: relatedByEmailRes.rows,
    savedAddresses: addressesRes.rows,
    bankAccounts: banksRes.rows,
    bookings: bookingsRes.rows,
    payments: paymentsRes.rows,
    savingsLedger: savingsRes.rows,
    notifications: notificationsRes.rows,
  };
}
