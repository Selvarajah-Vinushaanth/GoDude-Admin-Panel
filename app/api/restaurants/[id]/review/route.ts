import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import { reviewRestaurantAction } from '@/lib/services/restaurants.service';

const schema = z.object({
  decision: z.enum(['approved', 'rejected', 'suspended', 'request_info']),
  reason: z.string().max(500).optional(),
  commissionPct: z.number().min(0).max(50).optional(),
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid restaurant review payload' },
        { status: 400 }
      );
    }

    const result = await reviewRestaurantAction(auth.session, id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to review restaurant';
    return NextResponse.json({ error: msg }, { status: msg.includes('not found') ? 404 : 400 });
  }
}
