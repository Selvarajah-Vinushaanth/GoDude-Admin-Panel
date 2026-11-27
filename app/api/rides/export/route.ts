import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { buildRidesAccountingCsv, listRidesForExport } from '@/lib/services/operations.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { search, status, dateFrom, dateTo, sort, order } = parsePageParams(
    req.nextUrl.searchParams
  );

  try {
    const rows = await listRidesForExport({
      search,
      status: status || 'all',
      dateFrom,
      dateTo,
      sort,
      order,
    });
    const csv = buildRidesAccountingCsv(rows);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="godude-rides-accounting-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export rides CSV' },
      { status: 500 }
    );
  }
}
