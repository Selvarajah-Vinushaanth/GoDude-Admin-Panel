import React from 'react';
import { AdminShell } from '@/components/AdminShell';
import { requireAdminSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { checkGoDudeBackendHealth } from '@/lib/godude-api';

export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  const [dbResult, vmHealth] = await Promise.all([
    Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM restaurants WHERE approval_status = 'pending'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM drivers WHERE is_verified = FALSE OR vehicle_approved = FALSE`
      ),
    ])
      .then(([restRes, riderRes]) => ({
        ok: true as const,
        pendingRestaurants: Number(restRes.rows[0]?.count ?? 0),
        unverifiedRiders: Number(riderRes.rows[0]?.count ?? 0),
      }))
      .catch((err) => ({
        ok: false as const,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to connect to GoDude PostgreSQL database',
      })),
    checkGoDudeBackendHealth(),
  ]);

  return (
    <AdminShell
      admin={{
        email: session.email,
        fullName: session.fullName,
        accountId: session.accountId,
      }}
      alerts={{
        pendingRestaurants: dbResult.ok ? dbResult.pendingRestaurants : 0,
        unverifiedRiders: dbResult.ok ? dbResult.unverifiedRiders : 0,
      }}
      dbError={dbResult.ok ? null : dbResult.error}
      vmHealth={vmHealth}
    >
      {children}
    </AdminShell>
  );
}
