import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listFoodOrders } from '@/lib/services/operations.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, status, dateFrom, dateTo, sort, order } = parsePageParams(
    req.nextUrl.searchParams
  );

  try {
    const data = await listFoodOrders({
      page,
      pageSize,
      search,
      status,
      dateFrom,
      dateTo,
      sort,
      order,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load food orders' },
      { status: 500 }
    );
  }
}
