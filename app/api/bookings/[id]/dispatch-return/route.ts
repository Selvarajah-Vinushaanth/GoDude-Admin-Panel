import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { callGoDudeAdminApi } from '@/lib/godude-api';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const apiRes = await callGoDudeAdminApi(
    auth.session,
    `/bookings/${encodeURIComponent(id)}/dispatch-return`,
    { method: 'POST', body: {} }
  );

  if (!apiRes.reached) {
    return NextResponse.json(
      { error: 'Unable to reach GoDude backend to dispatch return leg.' },
      { status: 502 }
    );
  }
  if (!apiRes.ok) {
    return NextResponse.json(
      { error: apiRes.error || 'Failed to dispatch return leg' },
      { status: 400 }
    );
  }

  return NextResponse.json(apiRes.data ?? { ok: true });
}
