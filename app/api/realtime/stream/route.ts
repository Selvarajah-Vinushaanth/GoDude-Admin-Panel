import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SectionWatermarks {
  restaurants: string;
  bookings: string;
  riders: string;
  payments: string;
  notifications: string;
  pendingRestaurants: number;
  unverifiedRiders: number;
}

async function fetchWatermarks(): Promise<SectionWatermarks> {
  const res = await query<{
    rest_sig: string;
    pending_rest: string;
    book_sig: string;
    drv_sig: string;
    unverified_drv: string;
    pay_sig: string;
    notif_sig: string;
  }>(
    `SELECT
       (SELECT COALESCE(COUNT(*)::text, '0') || '|' || COALESCE(MAX(updated_at)::text, '') || '|' || COALESCE(SUM(CASE WHEN is_open THEN 1 ELSE 0 END)::text, '0') FROM restaurants) AS rest_sig,
       (SELECT COUNT(*)::text FROM restaurants WHERE approval_status = 'pending') AS pending_rest,
       (SELECT COALESCE(COUNT(*)::text, '0') || '|' || COALESCE(MAX(updated_at)::text, '') FROM bookings) AS book_sig,
       (SELECT COALESCE(COUNT(*)::text, '0') || '|' || COALESCE(MAX(updated_at)::text, '') || '|' || COALESCE(SUM(CASE WHEN is_online THEN 1 ELSE 0 END)::text, '0') FROM drivers) AS drv_sig,
       (SELECT COUNT(*)::text FROM drivers WHERE is_verified = FALSE OR vehicle_approved = FALSE) AS unverified_drv,
       (SELECT COALESCE(COUNT(*)::text, '0') || '|' || COALESCE(MAX(created_at)::text, '') FROM payment_transactions) AS pay_sig,
       (SELECT COALESCE(COUNT(*)::text, '0') || '|' || COALESCE(MAX(created_at)::text, '') FROM notifications) AS notif_sig`
  );
  const r = res.rows[0];
  return {
    restaurants: r?.rest_sig ?? '',
    bookings: r?.book_sig ?? '',
    riders: r?.drv_sig ?? '',
    payments: r?.pay_sig ?? '',
    notifications: r?.notif_sig ?? '',
    pendingRestaurants: Number(r?.pending_rest ?? 0),
    unverifiedRiders: Number(r?.unverified_drv ?? 0),
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      let prev: SectionWatermarks | null = null;
      try {
        prev = await fetchWatermarks();
        send({
          type: 'connected',
          changed: [],
          alerts: {
            pendingRestaurants: prev.pendingRestaurants,
            unverifiedRiders: prev.unverifiedRiders,
          },
        });
      } catch {
        // Ignore initial snapshot error; retry on interval
      }

      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const next = await fetchWatermarks();
          if (!prev) {
            prev = next;
            return;
          }
          const changed: string[] = [];
          if (next.restaurants !== prev.restaurants) changed.push('restaurants');
          if (next.bookings !== prev.bookings) changed.push('bookings');
          if (next.riders !== prev.riders) changed.push('riders');
          if (next.payments !== prev.payments) changed.push('payments');
          if (next.notifications !== prev.notifications) changed.push('notifications');
          prev = next;
          if (changed.length > 0) {
            send({
              type: 'sync',
              changed,
              alerts: {
                pendingRestaurants: next.pendingRestaurants,
                unverifiedRiders: next.unverifiedRiders,
              },
            });
          } else {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          }
        } catch {
          // Transient query failure ignored
        }
      }, 3000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollTimer);
        try {
          controller.close();
        } catch {
          // Ignore close error
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
