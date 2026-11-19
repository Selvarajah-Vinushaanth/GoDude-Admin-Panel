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
import { getCustomerDetail, listCustomers } from '../lib/services/customers.service';
import { getRiderDetail, listRiders } from '../lib/services/riders.service';
import { listRestaurants } from '../lib/services/restaurants.service';
import { listFoodOrders, listParcels, listRides } from '../lib/services/operations.service';
import { listTransactions } from '../lib/services/finance.service';
import {
  getSettingsSnapshot,
  listNotifications,
  searchNotificationRecipients,
} from '../lib/services/admin-comms.service';
import { deriveEffectiveRoles } from '../lib/services/shared';

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
  assert.equal(
    verifyPasswordSecret('GoDudeTest#123', { email: 'a@godude.lk', passwordHash: hash, fullName: 'A' }),
    true
  );
  assert.equal(
    verifyPasswordSecret('WrongPass', { email: 'a@godude.lk', passwordHash: hash, fullName: 'A' }),
    false
  );
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

test('authoritative multi-role derivation classifies abandoned onboarding and dual-role users consistently', () => {
  // Abandoned driver onboarding with customer bookings -> Customer + pending driver onboarding flag
  const abandoned = deriveEffectiveRoles({
    rawRole: 'driver',
    hasDriverProfile: false,
    hasRestaurantProfile: false,
    hasCustomerActivity: true,
  });
  assert.deepEqual(abandoned.roles, ['customer']);
  assert.equal(abandoned.isCustomer, true);
  assert.equal(abandoned.onboardingPendingRole, 'driver');

  // Dual-role partner who has a driver profile AND booked rides as a customer
  const dual = deriveEffectiveRoles({
    rawRole: 'partner',
    hasDriverProfile: true,
    hasRestaurantProfile: false,
    hasCustomerActivity: true,
  });
  assert.deepEqual(dual.roles, ['customer', 'driver']);
  assert.equal(dual.isCustomer, true);
  assert.equal(dual.isMultiRole, true);

  // Pure rider with no customer bookings
  const pureRider = deriveEffectiveRoles({
    rawRole: 'driver',
    hasDriverProfile: true,
    hasRestaurantProfile: false,
    hasCustomerActivity: false,
  });
  assert.deepEqual(pureRider.roles, ['driver']);
  assert.equal(pureRider.isCustomer, false);
});

test('Scenario A-E: database connectivity, dashboard KPIs, and cross-tab consistency match authoritative DB totals', async () => {
  const [res, vmHealth] = await Promise.all([
    query<{ ok: number }>('SELECT 1 AS ok'),
    checkGoDudeBackendHealth(),
  ]);
  assert.equal(res.rows[0]?.ok, 1);
  assert.equal(vmHealth.reachable, true, `Expected live VM backend reachable at ${vmHealth.url}`);
  assert.equal(vmHealth.postgres, 'connected');

  const [stats, customersOnly, allUsers, riders, restaurants, rides, activeRides, foodOrders, parcels, finance, notifs, settings] =
    await Promise.all([
      getOverviewStats(),
      listCustomers({ page: 1, pageSize: 100, role: 'customer' }),
      listCustomers({ page: 1, pageSize: 100, role: 'all' }),
      listRiders({ page: 1, pageSize: 100 }),
      listRestaurants({ page: 1, pageSize: 100 }),
      listRides({ page: 1, pageSize: 100 }),
      listRides({ page: 1, pageSize: 100, status: 'active' }),
      listFoodOrders({ page: 1, pageSize: 100 }),
      listParcels({ page: 1, pageSize: 100 }),
      listTransactions({ page: 1, pageSize: 100 }),
      listNotifications({ page: 1, pageSize: 100 }),
      getSettingsSnapshot(),
    ]);

  // Scenario E: Dashboard KPIs === Detailed Tab Totals
  assert.equal(stats.kpis.totalCustomers, customersOnly.total, 'Dashboard totalCustomers must match Customers tab');
  assert.equal(stats.kpis.totalCustomers, customersOnly.counts.customers);
  assert.equal(stats.kpis.totalPlatformUsers, allUsers.total, 'Dashboard totalPlatformUsers must match All Platform Users');
  assert.equal(stats.kpis.totalRiders, riders.total, 'Dashboard totalRiders must match Riders tab');
  assert.equal(stats.kpis.totalRiders, riders.counts.total);
  assert.equal(stats.kpis.onTripRiders, riders.counts.onTrip, 'Dashboard onTripRiders must match Riders onTrip count');
  assert.equal(stats.kpis.totalRestaurants, restaurants.total, 'Dashboard totalRestaurants must match Restaurants tab');
  assert.equal(stats.kpis.totalRides, rides.total, 'Dashboard totalRides must match Rides tab');
  assert.equal(stats.kpis.activeRides, activeRides.total, 'Dashboard activeRides must match Active Rides filter');
  assert.equal(stats.kpis.totalFoodOrders, foodOrders.total, 'Dashboard totalFoodOrders must match Food Orders tab');
  assert.equal(stats.kpis.totalParcels, parcels.total, 'Dashboard totalParcels must match Parcels tab');
  assert.equal(stats.kpis.totalTransactions, finance.total, 'Dashboard totalTransactions must match Finance tab');
  assert.equal(stats.kpis.verifiedRevenueLKR, finance.summary.verifiedLKR, 'Dashboard verifiedRevenueLKR must match Finance verifiedLKR');
  assert.equal(stats.kpis.refundedVolumeLKR, finance.summary.refundedLKR, 'Dashboard refundedVolumeLKR must match Finance refundedLKR');
  assert.equal(stats.kpis.platformCommissionLKR, finance.summary.commissionLKR, 'Dashboard commission must match Finance commission');
  assert.equal(stats.kpis.riderEarningsLKR, finance.summary.riderEarningsLKR, 'Dashboard rider earnings must match Finance rider earnings');
  assert.equal(stats.dailyTrends.length, 14);

  // Finance byService breakdown must sum to summary under filters
  const filteredFinance = await listTransactions({ page: 1, pageSize: 100, status: 'verified' });
  const sumByServiceVerified = filteredFinance.byService.reduce((acc, s) => acc + s.verifiedLKR, 0);
  const sumByServiceTx = filteredFinance.byService.reduce((acc, s) => acc + s.txCount, 0);
  assert.equal(sumByServiceVerified, filteredFinance.summary.verifiedLKR, 'byService verified sum must match filtered summary');
  assert.equal(sumByServiceTx, filteredFinance.summary.totalCount, 'byService tx count must match filtered summary');

  // Scenario A: Every booking customer appears in Customers Only AND in Notification Customer Recipients
  const customerIdSet = new Set(customersOnly.items.map((c) => c.id));
  for (const ride of rides.items) {
    assert.ok(
      customerIdSet.has(ride.customer_id),
      `Booking ${ride.id} customer (${ride.customer_name}) must appear in authoritative Customers list`
    );
  }
  const customerRecipients = await searchNotificationRecipients('customer', '');
  const recipientIdSet = new Set(customerRecipients.map((r) => r.user_id));
  for (const c of customersOnly.items.slice(0, 20)) {
    assert.ok(recipientIdSet.has(c.id), `Customer ${c.full_name} (${c.account_id}) must be reachable in Notifications`);
  }

  // Scenario A detail check: verify first customer detail matches list row counts & spend
  if (customersOnly.items[0]) {
    const c = customersOnly.items[0];
    const detail = await getCustomerDetail(c.id);
    assert.ok(detail);
    assert.equal(detail.customer.account_id, c.account_id);
    assert.equal(detail.summary.rides_count, c.rides_count);
    assert.equal(detail.summary.completed_spend_lkr, c.total_spent_lkr);
  }

  // Scenario B: Every rider has valid rating in [0, 5], accurate trips & earnings matching detail view
  for (const r of riders.items) {
    assert.ok(r.rating >= 0 && r.rating <= 5, `Rider ${r.full_name} rating ${r.rating} must be within 0..5`);
    const detail = await getRiderDetail(r.id);
    assert.ok(detail);
    assert.equal(detail.rider.account_id, r.account_id);
    assert.equal(detail.rider.total_earnings_lkr, r.earnings_lkr);
    assert.equal(detail.rider.completed_trips_count, r.completed_trips_count);
  }

  // DB invariant: no completed rides with fare > 0 have zero earnings & commission, and no driver rating > 5
  const invRes = await query<{ bad_ratings: string; zero_earnings: string; orphaned_driver_roles: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM drivers WHERE rating < 0 OR rating > 5) AS bad_ratings,
       (SELECT COUNT(*)::text FROM bookings WHERE status IN ('Completed', 'Delivered') AND total_paid_lkr > 0 AND rider_earnings_lkr = 0 AND platform_commission_lkr = 0) AS zero_earnings,
       (SELECT COUNT(*)::text FROM users u WHERE u.role = 'driver' AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.user_id = u.id) AND EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = u.id)) AS orphaned_driver_roles`
  );
  assert.equal(Number(invRes.rows[0]?.bad_ratings ?? -1), 0, 'No driver ratings may exceed 5.00');
  assert.equal(Number(invRes.rows[0]?.zero_earnings ?? -1), 0, 'All completed bookings must have recorded earnings/commission');
  assert.equal(Number(invRes.rows[0]?.orphaned_driver_roles ?? -1), 0, 'No customer with bookings should be stuck in driver role without driver profile');

  assert.ok(notifs.total >= 0);
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
