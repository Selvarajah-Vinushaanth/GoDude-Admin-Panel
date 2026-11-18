import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminLogin, getAdminCookieOptions } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid administrator email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid login request' },
        { status: 400 }
      );
    }

    const auth = await authenticateAdminLogin(parsed.data.email, parsed.data.password);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const res = NextResponse.json({
      ok: true,
      admin: {
        email: auth.session.email,
        fullName: auth.session.fullName,
        accountId: auth.session.accountId,
        role: auth.session.role,
      },
    });
    res.cookies.set({ ...getAdminCookieOptions(), value: auth.token });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 }
    );
  }
}
