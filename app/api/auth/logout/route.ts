import { NextResponse } from 'next/server';
import { getAdminCookieOptions } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...getAdminCookieOptions(0), value: '' });
  return res;
}
