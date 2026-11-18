import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listRestaurants } from '@/lib/services/restaurants.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, status, sort, order } = parsePageParams(
    req.nextUrl.searchParams
  );

  try {
    const data = await listRestaurants({ page, pageSize, search, status, sort, order });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load restaurants' },
      { status: 500 }
    );
  }
}
