import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth';

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;
  return NextResponse.json({ admin: auth.session });
}
