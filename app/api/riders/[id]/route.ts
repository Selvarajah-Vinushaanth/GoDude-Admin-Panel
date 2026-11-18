import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { getRiderDetail } from '@/lib/services/riders.service';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await context.params;
    const detail = await getRiderDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'Rider not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load rider detail' },
      { status: 500 }
    );
  }
}
