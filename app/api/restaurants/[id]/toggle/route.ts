import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import { toggleRestaurantOpenAction } from '@/lib/services/restaurants.service';

const schema = z.object({ isOpen: z.boolean() });

export async function PATCH(
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
      return NextResponse.json({ error: 'isOpen boolean is required' }, { status: 400 });
    }
    const result = await toggleRestaurantOpenAction(auth.session, id, parsed.data.isOpen);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to toggle store';
    return NextResponse.json({ error: msg }, { status: msg.includes('not found') ? 404 : 400 });
  }
}
