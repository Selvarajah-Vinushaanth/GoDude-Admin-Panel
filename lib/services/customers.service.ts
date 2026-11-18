import { query } from '../db';
import { buildSortClause } from './shared';

export interface CustomerListRow {
  id: string;
  account_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
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
  const clauses: string[] = [];

  if (params.role && params.role !== 'all') {
    values.push(params.role);
    clauses.push(`u.role = $${values.length}`);
  } else {
    clauses.push(`u.role != 'admin'`);
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

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users u ${whereSql}`,
    values
  );

  const listValues = [...values, params.pageSize, offset];
  const rowsRes = await query<CustomerListRow>(
    `SELECT
       u.id,
       u.account_id,
       u.full_name,
       u.email,
       u.phone,
       u.role,
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
     LEFT JOIN bookings b ON b.customer_id = u.id
     ${whereSql}
     GROUP BY u.id
     ${orderBy}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  return {
    items: rowsRes.rows,
    total: Number(countRes.rows[0]?.count ?? 0),
    page: params.page,
    pageSize: params.pageSize,
  };
}

export async function getCustomerDetail(id: string) {
  const [userRes, addressesRes, banksRes, bookingsRes, paymentsRes, savingsRes, notificationsRes] =
    await Promise.all([
      query(
        `SELECT id, account_id, full_name, email, phone, role, rating::float8 AS rating,
                total_ratings, selected_location_id, last_withdrawal_month,
                notifications_enabled, location_consent_enabled, member_since,
                avatar_url, created_at::text, updated_at::text
         FROM users WHERE id = $1 LIMIT 1`,
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
         LIMIT 50`,
        [id]
      ),
      query(
        `SELECT id, booking_id, method, amount_lkr, currency, status, gateway_ref,
                refund_amount_lkr, refunded_at::text, created_at::text
         FROM payment_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
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

  return {
    customer: user,
    savedAddresses: addressesRes.rows,
    bankAccounts: banksRes.rows,
    bookings: bookingsRes.rows,
    payments: paymentsRes.rows,
    savingsLedger: savingsRes.rows,
    notifications: notificationsRes.rows,
  };
}
