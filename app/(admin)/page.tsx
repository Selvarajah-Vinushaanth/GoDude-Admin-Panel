import Link from 'next/link';
import {
  Users,
  Bike,
  Store,
  Car,
  UtensilsCrossed,
  Package,
  CreditCard,
  ArrowUpRight,
  AlertCircle,
  Activity,
  Server,
} from 'lucide-react';
import { ServiceTrendsChart } from '@/components/Charts';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime, formatLKR, formatNumber } from '@/lib/format';
import { checkGoDudeBackendHealth } from '@/lib/godude-api';
import { getOverviewStats } from '@/lib/services/overview.service';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [overviewRes, vmHealth] = await Promise.all([
    getOverviewStats()
      .then((stats) => ({ ok: true as const, stats }))
      .catch((err) => ({
        ok: false as const,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to connect to GoDude Google Cloud VM database.',
      })),
    checkGoDudeBackendHealth(),
  ]);

  if (!overviewRes.ok) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unable to connect to GoDude backend / database
            </h2>
            <p className="mt-1 text-sm text-rose-700">{overviewRes.error}</p>
            <p className="mt-2 text-xs text-slate-500">
              Ensure the SSH database tunnel to <code className="font-mono">godude-prod-vm</code>{' '}
              (or <code className="font-mono">DATABASE_URL</code>) is active and reload this page.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Retry Connection
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { stats } = overviewRes;
  const { kpis } = stats;

  const topCards = [
    {
      label: 'Total Customers',
      value: formatNumber(kpis.totalCustomers),
      sub: 'Registered passenger & food users',
      href: '/customers',
      icon: Users,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Registered Riders',
      value: formatNumber(kpis.totalRiders),
      sub: `${kpis.onlineRiders} online · ${kpis.availableRiders} available · ${kpis.onTripRiders} active`,
      href: '/riders',
      icon: Bike,
      tone: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Restaurants',
      value: formatNumber(kpis.totalRestaurants),
      sub: `${kpis.openRestaurants} open · ${kpis.pendingRestaurants} pending approval`,
      href: '/restaurants',
      icon: Store,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Verified Revenue',
      value: formatLKR(kpis.verifiedRevenueLKR),
      sub: `${formatNumber(kpis.totalTransactions)} tx · ${formatLKR(kpis.platformCommissionLKR)} commission`,
      href: '/finance',
      icon: CreditCard,
      tone: 'bg-sky-50 text-sky-600',
    },
  ];

  const serviceModules = [
    {
      title: 'Ride Management',
      href: '/rides',
      icon: Car,
      accent: 'text-blue-600 bg-blue-50',
      total: kpis.totalRides,
      metrics: [
        { label: 'Active', val: kpis.activeRides, cls: 'text-blue-700' },
        { label: 'Completed', val: kpis.completedRides, cls: 'text-emerald-700' },
        { label: 'Cancelled', val: kpis.cancelledRides, cls: 'text-rose-600' },
      ],
    },
    {
      title: 'Food Orders',
      href: '/food-orders',
      icon: UtensilsCrossed,
      accent: 'text-emerald-600 bg-emerald-50',
      total: kpis.totalFoodOrders,
      metrics: [
        { label: 'Active', val: kpis.activeFoodOrders, cls: 'text-blue-700' },
        { label: 'Delivered', val: kpis.completedFoodOrders, cls: 'text-emerald-700' },
        { label: 'Cancelled', val: kpis.cancelledFoodOrders, cls: 'text-rose-600' },
      ],
    },
    {
      title: 'Parcel Deliveries',
      href: '/parcels',
      icon: Package,
      accent: 'text-amber-600 bg-amber-50',
      total: kpis.totalParcels,
      metrics: [
        { label: 'Active', val: kpis.activeParcels, cls: 'text-blue-700' },
        { label: 'Delivered', val: kpis.completedParcels, cls: 'text-emerald-700' },
        { label: 'Failed / Ret.', val: kpis.failedOrReturnedParcels, cls: 'text-rose-600' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live Infrastructure Status Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Server className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-slate-900">GoDude Google Cloud VM Source:</span>
          <span className="font-mono text-slate-600">
            {vmHealth.url || 'GODUDE_API_URL unset'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ring-1 ring-inset ${
              vmHealth.reachable
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                : 'bg-rose-50 text-rose-700 ring-rose-600/20'
            }`}
          >
            API: {vmHealth.reachable ? 'Online' : 'Unreachable'}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            PostgreSQL: Connected (Live Queries)
          </span>
          {vmHealth.reachable && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
              Redis: {vmHealth.redis}
            </span>
          )}
        </div>
      </section>

      {/* Top KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className={`rounded-xl p-2.5 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-600" />
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Pending Approvals Alert Banner (only shown or highlighted clearly) */}
      {(kpis.pendingRestaurants > 0 || kpis.unverifiedRiders > 0) && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-sm font-semibold text-amber-950">
                  Pending Verification & Onboarding Queue
                </h2>
                <p className="text-xs text-amber-800">
                  {kpis.pendingRestaurants} restaurant application(s) and {kpis.unverifiedRiders}{' '}
                  rider verification(s) await administrative review.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {kpis.pendingRestaurants > 0 && (
                <Link
                  href="/restaurants?status=pending"
                  className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Review Restaurants ({kpis.pendingRestaurants})
                </Link>
              )}
              {kpis.unverifiedRiders > 0 && (
                <Link
                  href="/riders?status=pending"
                  className="rounded-xl border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Review Riders ({kpis.unverifiedRiders})
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Three Service Operations Breakdown */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {serviceModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-blue-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-xl p-2 ${mod.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{mod.title}</h3>
                </div>
                <span className="text-lg font-bold text-slate-900">
                  {formatNumber(mod.total)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                {mod.metrics.map((m) => (
                  <div key={m.label}>
                    <p className="text-[11px] font-medium text-slate-500">{m.label}</p>
                    <p className={`mt-0.5 text-base font-bold ${m.cls}`}>
                      {formatNumber(m.val)}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </section>

      {/* Chart + Fleet Availability Breakdown */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ServiceTrendsChart data={stats.dailyTrends} />
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Unified Fleet State Summary
              </h3>
              <p className="text-xs text-slate-500">Live driver_state distribution</p>
            </div>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>

          <div className="mt-4 space-y-2.5">
            {stats.fleetBreakdown.map((item) => {
              const pct =
                kpis.totalRiders > 0 ? Math.round((item.count / kpis.totalRiders) * 100) : 0;
              return (
                <div key={item.state} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <StatusBadge value={item.state} />
                    <span className="font-semibold text-slate-700">
                      {formatNumber(item.count)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${Math.min(100, pct)}%` }}
                      className="h-full rounded-full bg-blue-600/80"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 text-xs">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-500">Rider Earnings</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {formatLKR(kpis.riderEarningsLKR)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-500">10% Savings Credits</p>
              <p className="mt-0.5 font-bold text-emerald-700">
                {formatLKR(kpis.savingsCreditedLKR)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-500">Refunded Volume</p>
              <p className="mt-0.5 font-bold text-rose-700">
                {formatLKR(kpis.refundedVolumeLKR)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-slate-500">Suspended Kitchens</p>
              <p className="mt-0.5 font-bold text-slate-900">
                {kpis.suspendedRestaurants} suspended / {kpis.rejectedRestaurants} rejected
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pending Applications + Recent Activity & Registrations */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Pending Restaurant Applications */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pending Restaurant Applications
              </h3>
              <p className="text-xs text-slate-500">Kitchens awaiting onboarding review</p>
            </div>
            <Link
              href="/restaurants?status=pending"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {stats.pendingRestaurantsList.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                All restaurant applications have been reviewed.
              </p>
            ) : (
              stats.pendingRestaurantsList.map((rest) => (
                <div
                  key={rest.id}
                  className="flex items-center justify-between gap-3 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{rest.name}</p>
                    <p className="truncate text-slate-500">
                      {rest.city} · Owner: {rest.owner_name || 'Unclaimed'} (
                      {rest.owner_phone || rest.contact_phone || 'No phone'})
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge value={rest.approval_status} />
                    <Link
                      href={`/restaurants?status=pending&inspect=${encodeURIComponent(rest.id)}`}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Platform Registrations */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Registrations</h3>
              <p className="text-xs text-slate-500">Newest customers, riders & merchants</p>
            </div>
            <Link href="/customers" className="text-xs font-semibold text-blue-600 hover:underline">
              Customers →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {stats.recentRegistrations.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {u.full_name}{' '}
                    <span className="font-mono text-[11px] font-normal text-slate-400">
                      ({u.account_id})
                    </span>
                  </p>
                  <p className="truncate text-slate-500">
                    {u.phone || u.email || 'No contact'} · {formatDateTime(u.created_at)}
                  </p>
                </div>
                <StatusBadge value={u.role} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Bookings Feed */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Platform Activity</h3>
            <p className="text-xs text-slate-500">Latest bookings across Rides, Food & Parcels</p>
          </div>
          <div className="flex gap-3 text-xs font-semibold text-blue-600">
            <Link href="/rides" className="hover:underline">Rides</Link>
            <Link href="/food-orders" className="hover:underline">Food</Link>
            <Link href="/parcels" className="hover:underline">Parcels</Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Booking ID</th>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Summary</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 pl-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">{b.id}</td>
                  <td className="py-2.5 px-3 text-slate-600">{b.service_type}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{b.customer_name}</td>
                  <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">{b.title}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge value={b.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    {formatLKR(b.total_paid_lkr)}
                  </td>
                  <td className="py-2.5 pl-3 text-right text-slate-500">
                    {formatDateTime(b.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
