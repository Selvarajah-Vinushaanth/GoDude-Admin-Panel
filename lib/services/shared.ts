import { PoolClient } from 'pg';
import { query } from '../db';

/**
 * Authoritative timezone used across all Admin Panel date filters and daily charts.
 */
export const COLOMBO_TZ = 'Asia/Colombo';

/**
 * Canonical booking status groups shared across Dashboard KPIs and Operations tabs
 * so counts and filtered lists match 100% everywhere.
 */
export const ACTIVE_RIDE_STATUSES = ['Searching', 'Rider Assigned', 'Arrived', 'On the Way'] as const;
export const ACTIVE_FOOD_STATUSES = [
  'Searching',
  'Confirmed',
  'Preparing',
  'Ready for Pickup',
  'Rider Assigned',
  'Arrived',
  'On the Way',
] as const;
export const ACTIVE_PARCEL_STATUSES = [
  'Searching',
  'Rider Assigned',
  'Arrived',
  'On the Way',
  'Return Initiated',
] as const;
export const COMPLETED_BOOKING_STATUSES = ['Completed', 'Delivered'] as const;

/**
 * Authoritative SQL predicates for entity classification derived from relational tables
 * (users, drivers, restaurants, bookings, payment_transactions, savings_transactions).
 *
 * ONE ENTITY = ONE AUTHORITATIVE IDENTITY:
 * - A user is a Customer if they are non-admin AND (role = 'customer' OR have any customer
 *   booking/payment/savings activity OR have no driver/restaurant profile yet).
 * - A user is a Rider if they have a row in `drivers`.
 * - A user is a Merchant if they own a row in `restaurants`.
 * Dual-role users (e.g., a Rider who also books rides as a Customer) retain both roles
 * accurately without creating duplicate identities or vanishing from customer counts.
 */
export function hasDriverProfileSql(alias = 'u'): string {
  return `EXISTS (SELECT 1 FROM drivers d_rel WHERE d_rel.user_id = ${alias}.id)`;
}

export function hasRestaurantProfileSql(alias = 'u'): string {
  return `EXISTS (SELECT 1 FROM restaurants r_rel WHERE r_rel.owner_user_id = ${alias}.id)`;
}

export function hasCustomerActivitySql(alias = 'u'): string {
  return `(EXISTS (SELECT 1 FROM bookings b_rel WHERE b_rel.customer_id = ${alias}.id) OR EXISTS (SELECT 1 FROM payment_transactions pt_rel WHERE pt_rel.user_id = ${alias}.id) OR EXISTS (SELECT 1 FROM savings_transactions st_rel WHERE st_rel.user_id = ${alias}.id))`;
}

export function authoritativeIsCustomerSql(alias = 'u'): string {
  return `(${alias}.role != 'admin' AND (${alias}.role = 'customer' OR ${hasCustomerActivitySql(alias)} OR (NOT ${hasDriverProfileSql(alias)} AND NOT ${hasRestaurantProfileSql(alias)})))`;
}

export function colomboDateFilterSql(columnSql: string, paramIndex: number, op: '>=' | '<='): string {
  return `(${columnSql} AT TIME ZONE '${COLOMBO_TZ}')::date ${op} $${paramIndex}::date`;
}

export type EffectiveRoleTag = 'customer' | 'driver' | 'merchant' | 'admin';

export function deriveEffectiveRoles(input: {
  rawRole: string;
  hasDriverProfile: boolean;
  hasRestaurantProfile: boolean;
  hasCustomerActivity: boolean;
}): {
  roles: EffectiveRoleTag[];
  primaryRole: EffectiveRoleTag;
  isCustomer: boolean;
  isMultiRole: boolean;
  onboardingPendingRole: 'driver' | 'merchant' | null;
} {
  if (input.rawRole === 'admin') {
    return {
      roles: ['admin'],
      primaryRole: 'admin',
      isCustomer: false,
      isMultiRole: false,
      onboardingPendingRole: null,
    };
  }

  const isCustomer =
    input.rawRole === 'customer' ||
    input.hasCustomerActivity ||
    (!input.hasDriverProfile && !input.hasRestaurantProfile);

  const roles: EffectiveRoleTag[] = [];
  if (isCustomer) roles.push('customer');
  if (input.hasDriverProfile) roles.push('driver');
  if (input.hasRestaurantProfile) roles.push('merchant');

  let onboardingPendingRole: 'driver' | 'merchant' | null = null;
  if (input.rawRole === 'driver' && !input.hasDriverProfile) {
    onboardingPendingRole = 'driver';
  } else if (input.rawRole === 'merchant' && !input.hasRestaurantProfile) {
    onboardingPendingRole = 'merchant';
  }

  const primaryRole: EffectiveRoleTag = roles[0] ?? 'customer';
  return {
    roles: roles.length > 0 ? roles : ['customer'],
    primaryRole,
    isCustomer,
    isMultiRole: roles.length > 1,
    onboardingPendingRole,
  };
}

export async function recordAuditLog(
  params: {
    adminUserId: string | null;
    adminEmail?: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    details?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<void> {
  const exec = client ? client.query.bind(client) : query;
  try {
    await exec(
      `INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        params.adminUserId,
        params.action,
        params.targetType,
        params.targetId,
        params.reason ?? '',
        JSON.stringify({
          ...(params.adminEmail ? { adminEmail: params.adminEmail } : {}),
          ...(params.details ?? {}),
        }),
      ]
    );
  } catch (err) {
    console.warn('[AdminAudit] Failed to insert audit log:', err);
  }
}

export async function insertNotification(
  params: {
    userId: string;
    bookingId?: string | null;
    roleTarget: 'customer' | 'merchant' | 'driver' | 'admin';
    eventType: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<{ id: string; created_at: string } | null> {
  const exec = client ? client.query.bind(client) : query;
  const bookingId = params.bookingId ?? null;

  if (bookingId) {
    const res = await exec<{ id: string; created_at: string }>(
      `INSERT INTO notifications (user_id, booking_id, role_target, event_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (user_id, booking_id, event_type) WHERE booking_id IS NOT NULL
       DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, data = EXCLUDED.data, is_read = FALSE, created_at = NOW()
       RETURNING id, created_at::text`,
      [
        params.userId,
        bookingId,
        params.roleTarget,
        params.eventType,
        params.title,
        params.body,
        JSON.stringify(params.data ?? {}),
      ]
    );
    return res.rows[0] ?? null;
  }

  const res = await exec<{ id: string; created_at: string }>(
    `INSERT INTO notifications (user_id, booking_id, role_target, event_type, title, body, data)
     VALUES ($1, NULL, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, created_at::text`,
    [
      params.userId,
      params.roleTarget,
      params.eventType,
      params.title,
      params.body,
      JSON.stringify(params.data ?? {}),
    ]
  );
  return res.rows[0] ?? null;
}

export function buildSortClause(
  requested: string | undefined,
  order: 'ASC' | 'DESC',
  allowlist: Record<string, string>,
  fallbackColumn: string
): string {
  const col = requested && allowlist[requested] ? allowlist[requested] : fallbackColumn;
  return `ORDER BY ${col} ${order}`;
}
