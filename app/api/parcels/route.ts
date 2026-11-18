import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listParcels } from '@/lib/services/operations.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, status, dateFrom, dateTo, sort, order } = parsePageParams(
    req.nextUrl.searchParams
  );

  try {
    const data = await listParcels({
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
      { error: err instanceof Error ? err.message : 'Failed to load parcel deliveries' },
      { status: 500 }
    );
  }
}
