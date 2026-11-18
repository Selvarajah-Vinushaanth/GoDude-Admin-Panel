import React from 'react';
import { AdminShell } from '@/components/AdminShell';
import { requireAdminSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  const [restPendingRes, riderPendingRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM restaurants WHERE approval_status = 'pending'`
    ).catch(() => ({ rows: [{ count: '0' }] })),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM drivers WHERE is_verified = FALSE OR vehicle_approved = FALSE`
    ).catch(() => ({ rows: [{ count: '0' }] })),
  ]);

  return (
    <AdminShell
      admin={{
        email: session.email,
        fullName: session.fullName,
        accountId: session.accountId,
      }}
      alerts={{
        pendingRestaurants: Number(restPendingRes.rows[0]?.count ?? 0),
        unverifiedRiders: Number(riderPendingRes.rows[0]?.count ?? 0),
      }}
    >
      {children}
    </AdminShell>
  );
}
