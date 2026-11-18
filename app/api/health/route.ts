import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkGoDudeBackendHealth } from '@/lib/godude-api';

export async function GET() {
  const backendHealth = await checkGoDudeBackendHealth();
  try {
    await query('SELECT 1');
    return NextResponse.json({
      status: 'ok',
      service: 'godude-admin-panel',
      postgres: 'connected',
      vmBackend: backendHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        postgres: 'disconnected',
        vmBackend: backendHealth,
        error: err instanceof Error ? err.message : 'Database connection failed',
      },
      { status: 503 }
    );
  }
}
