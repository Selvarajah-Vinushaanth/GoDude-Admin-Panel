import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import {
  authenticateAdminLogin,
  hashPasswordScrypt,
  mintBackendAdminJwt,
  signSessionToken,
  verifyPasswordSecret,
  verifySessionToken,
} from '../lib/auth';
import { getPool, query } from '../lib/db';
import { checkGoDudeBackendHealth } from '../lib/godude-api';
import { getOverviewStats } from '../lib/services/overview.service';
import { listCustomers } from '../lib/services/customers.service';
import { listRiders } from '../lib/services/riders.service';
import { listRestaurants } from '../lib/services/restaurants.service';
import { listFoodOrders, listParcels, listRides } from '../lib/services/operations.service';
import { listTransactions } from '../lib/services/finance.service';
import { getSettingsSnapshot, listNotifications } from '../lib/services/admin-comms.service';

// Load local .env if present
function loadEnvFile() {
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // Ignore when env is injected by CI
  }
}

before(() => {
  loadEnvFile();
});

after(async () => {
  await getPool().end();
});

test('scrypt password hashing & verification works securely', () => {
  const hash = hashPasswordScrypt('GoDudeTest#123');
  assert.equal(verifyPasswordSecret('GoDudeTest#123', { email: 'a@godude.lk', passwordHash: hash, fullName: 'A' }), true);
  assert.equal(verifyPasswordSecret('WrongPass', { email: 'a@godude.lk', passwordHash: hash, fullName: 'A' }), false);
});

test('session token signing rejects tampered or expired tokens', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signSessionToken({
    email: 'admin@godude.lk',
    fullName: 'Ops Admin',
    accountId: 'ADM-1',
    dbUserId: '00000000-0000-0000-0000-000000000001',
    phone: '+94770000000',
    role: 'admin',
    exp: now + 3600,
  });
  const verified = verifySessionToken(token);
  assert.equal(verified?.email, 'admin@godude.lk');
  assert.equal(verifySessionToken(`${token}x`), null);

  const expiredToken = signSessionToken({
    email: 'admin@godude.lk',
    fullName: 'Ops Admin',
    accountId: 'ADM-1',
    dbUserId: '00000000-0000-0000-0000-000000000001',
    phone: '+94770000000',
    role: 'admin',
    exp: now - 10,
  });
  assert.equal(verifySessionToken(expiredToken), null);

  const backendJwt = mintBackendAdminJwt(verified!);
  assert.ok(backendJwt && backendJwt.split('.').length === 3);
});

test('database connectivity, Google Cloud VM health, & executive overview return real GoDude metrics', async () => {
  const [res, vmHealth] = await Promise.all([
    query<{ ok: number }>('SELECT 1 AS ok'),
    checkGoDudeBackendHealth(),
  ]);
  assert.equal(res.rows[0]?.ok, 1);
  assert.equal(vmHealth.reachable, true, `Expected live VM backend reachable at ${vmHealth.url}`);
  assert.equal(vmHealth.postgres, 'connected');

  const stats = await getOverviewStats();
  assert.ok(stats.kpis.totalCustomers > 0, 'Expected real customers in GoDude VM DB');
  assert.ok(stats.kpis.totalRiders > 0, 'Expected real riders in GoDude VM DB');
  assert.ok(stats.kpis.totalRestaurants > 0, 'Expected real restaurants in GoDude VM DB');
  assert.ok(stats.kpis.totalTransactions > 0, 'Expected real transactions in GoDude VM DB');
  assert.equal(stats.dailyTrends.length, 14);
});

test('paginated modules read real database data accurately', async () => {
  const [customers, riders, restaurants, rides, foodOrders, parcels, finance, notifs, settings] =
    await Promise.all([
      listCustomers({ page: 1, pageSize: 10, role: 'customer' }),
      listRiders({ page: 1, pageSize: 10 }),
      listRestaurants({ page: 1, pageSize: 10 }),
      listRides({ page: 1, pageSize: 10 }),
      listFoodOrders({ page: 1, pageSize: 10 }),
      listParcels({ page: 1, pageSize: 10 }),
      listTransactions({ page: 1, pageSize: 10 }),
      listNotifications({ page: 1, pageSize: 10 }),
      getSettingsSnapshot(),
    ]);

  assert.ok(customers.total > 0 && customers.items.length <= 10);
  assert.ok(riders.total > 0 && riders.items.length <= 10);
  assert.ok(restaurants.total > 0 && restaurants.items.length <= 10);
  assert.ok(rides.total > 0 && rides.items.length <= 10);
  assert.ok(foodOrders.total > 0 && foodOrders.items.length <= 10);
  assert.ok(parcels.total > 0 && parcels.items.length <= 10);
  assert.ok(finance.total > 0 && finance.items.length <= 10);
  assert.ok(notifs.total > 0 && notifs.items.length <= 10);
  assert.ok(settings.vehicles.length >= 3);
});

test('ordinary customers/drivers cannot sign in as admin and invalid credentials fail', async () => {
  const custRes = await query<{ email: string }>(
    `SELECT email FROM users WHERE role = 'customer' AND email <> '' LIMIT 1`
  );
  if (custRes.rows[0]?.email) {
    const denied = await authenticateAdminLogin(custRes.rows[0].email, 'anything');
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
  }

  const badLogin = await authenticateAdminLogin('admin@godude.lk', 'wrong-password');
  assert.equal(badLogin.ok, false);
  assert.equal(badLogin.status, 401);
});
