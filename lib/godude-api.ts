import { AdminSession, mintBackendAdminJwt } from './auth';

export interface BackendCallResult<T = unknown> {
  reached: boolean;
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function callGoDudeAdminApi<T = unknown>(
  session: AdminSession,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}
): Promise<BackendCallResult<T>> {
  const baseUrl = process.env.GODUDE_API_URL?.trim().replace(/\/$/, '');
  const jwt = mintBackendAdminJwt(session);
  if (!baseUrl || !jwt) {
    return { reached: false, ok: false, status: 0, error: 'Backend API bridge not configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}/api/admin${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        reached: true,
        ok: false,
        status: res.status,
        error: typeof json?.error === 'string' ? json.error : `Backend HTTP ${res.status}`,
        data: json as T,
      };
    }

    return { reached: true, ok: true, status: res.status, data: json as T };
  } catch (err) {
    return {
      reached: false,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Backend unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}
