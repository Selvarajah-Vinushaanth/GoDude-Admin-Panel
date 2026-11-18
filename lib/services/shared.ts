import { PoolClient } from 'pg';
import { query } from '../db';

export async function recordAuditLog(
  params: {
    adminUserId: string;
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
        JSON.stringify(params.details ?? {}),
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
