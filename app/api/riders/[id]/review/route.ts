import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import { reviewRiderAction } from '@/lib/services/riders.service';

const reviewSchema = z.object({
  action: z.enum([
    'approve',
    'reject',
    'suspend',
    'request_info',
    'restore_available',
    'recalculate',
  ]),
  reason: z.string().max(400).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid rider action' },
        { status: 400 }
      );
    }

    const result = await reviewRiderAction(auth.session, id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process rider review';
    const status = msg.includes('active') ? 409 : msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
