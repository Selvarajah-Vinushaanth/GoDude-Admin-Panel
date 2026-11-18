import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import { reassignParcelAdminAction } from '@/lib/services/operations.service';

const schema = z.object({
  reason: z.string().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    const reason = parsed.success ? parsed.data.reason ?? '' : '';
    const result = await reassignParcelAdminAction(auth.session, id, reason);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reassign parcel';
    return NextResponse.json({ error: msg }, { status: msg.includes('not found') ? 404 : 400 });
  }
}
