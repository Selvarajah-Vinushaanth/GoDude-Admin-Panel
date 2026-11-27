import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { enumerateDays, zipTextFiles } from '@/lib/export-zip';
import { parsePageParams } from '@/lib/format';
import {
  buildRidesAccountingCsv,
  listRidesForExport,
  rideExportDay,
} from '@/lib/services/operations.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { search, status, dateFrom, dateTo, sort, order } = parsePageParams(
    req.nextUrl.searchParams
  );

  try {
    // Both dates selected -> one CSV per day, zipped. Validate before hitting the DB.
    const days = dateFrom && dateTo ? enumerateDays(dateFrom, dateTo) : null;

    const rows = await listRidesForExport({
      search,
      status: status || 'all',
      dateFrom,
      dateTo,
      sort,
      order,
    });

    if (days) {
      const byDay = new Map<string, typeof rows>(days.map((d) => [d, []]));
      for (const row of rows) {
        byDay.get(rideExportDay(row))?.push(row);
      }
      const files: Record<string, string> = {};
      for (const [day, dayRows] of byDay) {
        files[`godude-rides-accounting-${day}.csv`] = buildRidesAccountingCsv(dayRows);
      }
      const zip = zipTextFiles(files);
      const name =
        days.length === 1
          ? `godude-rides-accounting-${days[0]}.zip`
          : `godude-rides-accounting-${days[0]}_to_${days[days.length - 1]}.zip`;
      return new NextResponse(new Uint8Array(zip), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

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
    const message = err instanceof Error ? err.message : 'Failed to export rides';
    const isInput = /Date|date range|"To"/.test(message);
    return NextResponse.json({ error: message }, { status: isInput ? 400 : 500 });
  }
}
