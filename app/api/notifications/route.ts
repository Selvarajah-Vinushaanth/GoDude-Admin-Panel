import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import {
  listNotifications,
  searchNotificationRecipients,
  sendAdminInstruction,
} from '@/lib/services/admin-comms.service';

const sendSchema = z.object({
  userId: z.string().uuid('Valid recipient user ID required'),
  roleTarget: z.enum(['customer', 'merchant', 'driver']),
  eventType: z.string().min(2).max(80),
  title: z.string().min(3, 'Notification title must be at least 3 characters').max(140),
  body: z.string().min(5, 'Instruction message must be at least 5 characters').max(1000),
  restaurantId: z.string().optional(),
  bookingId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, get } = parsePageParams(req.nextUrl.searchParams);
  const mode = get('mode');
  const roleTarget = get('roleTarget') || 'all';

  try {
    if (mode === 'recipients') {
      const recipients = await searchNotificationRecipients(
        roleTarget === 'all' ? 'merchant' : roleTarget,
        search
      );
      return NextResponse.json({ recipients });
    }
    const data = await listNotifications({ page, pageSize, search, roleTarget });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load notifications' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid notification payload' },
        { status: 400 }
      );
    }

    const notification = await sendAdminInstruction(auth.session, parsed.data);
    return NextResponse.json({ ok: true, notification }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send notification' },
      { status: 400 }
    );
  }
}
