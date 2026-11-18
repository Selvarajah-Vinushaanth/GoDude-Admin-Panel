import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { parsePageParams } from '@/lib/format';
import { listCustomers } from '@/lib/services/customers.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const { page, pageSize, search, sort, order, get } = parsePageParams(req.nextUrl.searchParams);
  const role = get('role') || 'customer';

  try {
    const data = await listCustomers({ page, pageSize, search, role, sort, order });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load customers' },
      { status: 500 }
    );
  }
}
