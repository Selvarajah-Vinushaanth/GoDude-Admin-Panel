import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listRiders } from '@/lib/services/riders.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, status, sort, order, get } = parsePageParams(
    req.nextUrl.searchParams
  );
  const vehicleType = get('vehicleType') || 'all';

  try {
    const data = await listRiders({ page, pageSize, search, status, vehicleType, sort, order });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load riders' },
      { status: 500 }
    );
  }
}
