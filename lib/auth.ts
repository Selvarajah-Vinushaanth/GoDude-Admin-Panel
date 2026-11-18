import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { query } from './db';

export const ADMIN_SESSION_COOKIE = 'godude_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface AdminSession {
  email: string;
  fullName: string;
  accountId: string;
  dbUserId: string | null;
  phone: string;
  role: 'admin';
  exp: number;
}

interface AllowedAdminAccount {
  email: string;
  passwordHash?: string;
  password?: string;
  fullName: string;
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET (at least 16 characters) must be configured');
  }
  return secret;
}

function getAllowedAdmins(): AllowedAdminAccount[] {
  const list: AllowedAdminAccount[] = [];

  const rawJson = process.env.ADMIN_ACCOUNTS_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.email === 'string') {
            list.push({
              email: item.email.trim().toLowerCase(),
              passwordHash: typeof item.passwordHash === 'string' ? item.passwordHash : undefined,
              password: typeof item.password === 'string' ? item.password : undefined,
              fullName:
                typeof item.fullName === 'string' && item.fullName.trim()
                  ? item.fullName.trim()
                  : 'GoDude Administrator',
            });
          }
        }
      }
    } catch {
      console.error('[AdminAuth] Failed to parse ADMIN_ACCOUNTS_JSON');
    }
  }

  const primaryEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const primaryHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const primaryPass = process.env.ADMIN_PASSWORD?.trim();
  if (primaryEmail && (primaryHash || primaryPass)) {
    const exists = list.some((a) => a.email === primaryEmail);
    if (!exists) {
      list.push({
        email: primaryEmail,
        passwordHash: primaryHash,
        password: primaryPass,
        fullName: process.env.ADMIN_FULL_NAME?.trim() || 'GoDude Operations Admin',
      });
    }
  }

  return list;
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasswordSecret(password: string, account: AllowedAdminAccount): boolean {
  if (account.passwordHash && account.passwordHash.startsWith('scrypt:')) {
    const parts = account.passwordHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    if (!salt || !hexHash) return false;
    try {
      const candidate = crypto.scryptSync(password, salt, 64);
      const stored = Buffer.from(hexHash, 'hex');
      if (candidate.length !== stored.length) return false;
      return crypto.timingSafeEqual(candidate, stored);
    } catch {
      return false;
    }
  }

  if (account.password) {
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(account.password).digest();
    return crypto.timingSafeEqual(a, b);
  }

  return false;
}

export function signSessionToken(payload: AdminSession): string {
  const secret = getSessionSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const secret = getSessionSecret();
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSession;
    if (
      !parsed ||
      parsed.role !== 'admin' ||
      typeof parsed.email !== 'string' ||
      (parsed.dbUserId !== null && typeof parsed.dbUserId !== 'string') ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function mintBackendAdminJwt(session: AdminSession): string | null {
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret || !session.dbUserId) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url'
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: session.dbUserId,
      accountId: session.accountId,
      phone: session.phone,
      role: 'admin',
      iat: now,
      exp: now + 300,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export async function authenticateAdminLogin(
  emailInput: string,
  password: string
): Promise<{ ok: true; session: AdminSession; token: string } | { ok: false; status: number; error: string }> {
  const identifier = emailInput.trim().toLowerCase();
  if (!identifier || !password) {
    return { ok: false, status: 400, error: 'Email and password are required.' };
  }

  // First ensure an ordinary customer, driver, or merchant cannot gain access
  const nonAdminCheck = await query<{ role: string }>(
    `SELECT role FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [identifier]
  );
  if (nonAdminCheck.rows[0] && nonAdminCheck.rows[0].role !== 'admin') {
    return {
      ok: false,
      status: 403,
      error: 'Access denied. Only authorized platform administrators may sign in.',
    };
  }

  const allowed = getAllowedAdmins();
  const matched = allowed.find((a) => a.email === identifier);
  if (!matched || !verifyPasswordSecret(password, matched)) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid administrator credentials or unauthorized account.',
    };
  }

  // Bind to an existing verified admin operator record in PostgreSQL users table (no customer/driver fallback)
  const adminUserRes = await query<{
    id: string;
    account_id: string;
    full_name: string;
    phone: string | null;
    email: string;
    role: string;
  }>(
    `SELECT id, account_id, full_name, phone, email, role
     FROM users
     WHERE role = 'admin'
     ORDER BY CASE WHEN LOWER(email) = $1 THEN 0 ELSE 1 END, created_at ASC
     LIMIT 1`,
    [identifier]
  );

  const dbAdmin = adminUserRes.rows[0] ?? null;

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const session: AdminSession = {
    email: matched.email,
    fullName: matched.fullName || dbAdmin?.full_name || 'GoDude Operations Admin',
    accountId: dbAdmin?.account_id || 'ADM-ALLOWLIST',
    dbUserId: dbAdmin?.id ?? null,
    phone: dbAdmin?.phone || '',
    role: 'admin',
    exp,
  };

  const token = signSessionToken(session);
  return { ok: true, session, token };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(raw);
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireAdminApi(): Promise<
  { session: AdminSession; errorResponse?: never } | { session?: never; errorResponse: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Administrator authentication required' },
        { status: 401 }
      ),
    };
  }
  return { session };
}

export function getAdminCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    name: ADMIN_SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
