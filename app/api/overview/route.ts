import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';
import { getOverviewStats } from '@/lib/services/overview.service';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const data = await getOverviewStats();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load overview metrics' },
      { status: 500 }
    );
  }
}
