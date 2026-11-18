import { AdminSession, mintBackendAdminJwt } from './auth';

export interface BackendCallResult<T = unknown> {
  reached: boolean;
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface GoDudeBackendHealth {
  reachable: boolean;
  url: string;
  status: string;
  postgres: string;
  redis: string;
  error?: string;
}

export async function checkGoDudeBackendHealth(): Promise<GoDudeBackendHealth> {
  const baseUrl = (process.env.GODUDE_API_URL || '').trim().replace(/\/$/, '');
  if (!baseUrl) {
    return {
      reachable: false,
      url: '',
      status: 'unconfigured',
      postgres: 'unknown',
      redis: 'unknown',
      error: 'GODUDE_API_URL not set',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, string>;
    return {
      reachable: res.ok,
      url: baseUrl,
      status: json.status || (res.ok ? 'ok' : `HTTP ${res.status}`),
      postgres: json.postgres || 'unknown',
      redis: json.redis || 'unknown',
      error: res.ok ? undefined : json.error || `Backend returned ${res.status}`,
    };
  } catch (err) {
    return {
      reachable: false,
      url: baseUrl,
      status: 'unreachable',
      postgres: 'unknown',
      redis: 'unknown',
      error: err instanceof Error ? err.message : 'Unable to reach GoDude backend',
    };
  } finally {
    clearTimeout(timer);
  }
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
