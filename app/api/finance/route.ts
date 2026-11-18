import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listTransactions } from '@/lib/services/finance.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, status, dateFrom, dateTo, sort, order, get } = parsePageParams(
    req.nextUrl.searchParams
  );
  const serviceType = get('serviceType') || 'all';

  try {
    const data = await listTransactions({
      page,
      pageSize,
      search,
      status,
      serviceType,
      dateFrom,
      dateTo,
      sort,
      order,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load financial transactions' },
      { status: 500 }
    );
  }
}
