'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Bike,
  Store,
  Car,
  UtensilsCrossed,
  Package,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ShieldCheck,
  AlertTriangle,
  Server,
} from 'lucide-react';
import type { GoDudeBackendHealth } from '@/lib/godude-api';

interface AdminShellProps {
  admin: {
    email: string;
    fullName: string;
    accountId: string;
  };
  alerts: {
    pendingRestaurants: number;
    unverifiedRiders: number;
  };
  dbError?: string | null;
  vmHealth?: GoDudeBackendHealth;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/riders', label: 'Riders', icon: Bike, alertKey: 'unverifiedRiders' as const },
  { href: '/restaurants', label: 'Restaurants', icon: Store, alertKey: 'pendingRestaurants' as const },
  { href: '/rides', label: 'Ride Management', icon: Car },
  { href: '/food-orders', label: 'Food Orders', icon: UtensilsCrossed },
  { href: '/parcels', label: 'Parcel Deliveries', icon: Package },
  { href: '/finance', label: 'Finance', icon: CreditCard },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Executive Overview',
    subtitle: 'Live platform metrics, fleet status, pending approvals & recent activity',
  },
  '/customers': {
    title: 'Customer Management',
    subtitle: 'Inspect registered customers, service histories, savings & payment records',
  },
  '/riders': {
    title: 'Rider & Driver Operations',
    subtitle: 'Verify rider licenses & vehicles, monitor availability states & earnings',
  },
  '/restaurants': {
    title: 'Restaurant Onboarding & Management',
    subtitle: 'Review partner applications, approve kitchens, inspect menus & send instructions',
  },
  '/rides': {
    title: 'Ride Management',
    subtitle: 'Monitor Point-to-Point & Flexible metered rides, fares & cancellations',
  },
  '/food-orders': {
    title: 'Food Orders',
    subtitle: 'Track restaurant preparation, rider assignment, menu items & payments',
  },
  '/parcels': {
    title: 'Parcel & Pick & Drop',
    subtitle: 'Inspect sender/recipient details, OTP lifecycle stages, reassignments & returns',
  },
  '/finance': {
    title: 'Finance & Transactions',
    subtitle: 'Verified payments, refunds, platform commissions & settlement metrics',
  },
  '/notifications': {
    title: 'Notifications & Administrative Instructions',
    subtitle: 'Send review instructions to restaurant owners, riders & customers',
  },
  '/settings': {
    title: 'Platform Settings & Audit Logs',
    subtitle: 'Vehicle pricing tiers, delivery fees, parcel configuration & admin audit trail',
  },
};

export function AdminShell({ admin, alerts, dbError, vmHealth, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const meta = PAGE_TITLES[pathname] ?? {
    title: 'GoDude Admin',
    subtitle: 'Enterprise Operations Console',
  };
  const totalPendingAlerts = alerts.pendingRestaurants + alerts.unverifiedRiders;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = quickQuery.trim();
    if (!q) return;
    const upper = q.toUpperCase();
    if (upper.startsWith('ORD-') || upper.startsWith('FOD-')) {
      router.push(`/food-orders?search=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('PAR-') || upper.startsWith('PKD-')) {
      router.push(`/parcels?search=${encodeURIComponent(q)}`);
    } else if (upper.startsWith('RID-') || upper.startsWith('FLX-')) {
      router.push(`/rides?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/customers?role=all&search=${encodeURIComponent(q)}`);
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-sm shadow-blue-600/25">
            GD
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">GoDude</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Enterprise Control</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const badge = item.alertKey ? alerts[item.alertKey] : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-50/90 text-blue-700 shadow-2xs ring-1 ring-blue-600/15'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{item.label}</span>
              </span>
              {badge > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3.5 space-y-2.5">
        {vmHealth && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
              <Server className="h-3.5 w-3.5 text-blue-600" />
              VM Backend
            </span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                vmHealth.reachable ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  vmHealth.reachable ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              {vmHealth.reachable ? 'Connected' : 'Unreachable'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{admin.fullName}</p>
            <p className="truncate text-[11px] text-slate-500">{admin.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-64 border-r border-slate-200 bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{meta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <form onSubmit={handleQuickSearch} className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Jump to ID or customer..."
                className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:w-64 focus:border-blue-500 focus:bg-white"
              />
            </form>

            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Approval notifications"
                className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" />
                {totalPendingAlerts > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {totalPendingAlerts}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <p className="text-xs font-semibold text-slate-900">
                      Action Required Queue
                    </p>
                    <div className="mt-2.5 space-y-2">
                      <Link
                        href="/restaurants?status=pending"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <span className="font-medium text-slate-700">Pending Restaurants</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                          {alerts.pendingRestaurants}
                        </span>
                      </Link>
                      <Link
                        href="/riders?status=pending"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs hover:border-blue-200 hover:bg-blue-50/50"
                      >
                        <span className="font-medium text-slate-700">Unverified Riders</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                          {alerts.unverifiedRiders}
                        </span>
                      </Link>
                      <Link
                        href="/notifications"
                        onClick={() => setNotifOpen(false)}
                        className="block pt-1 text-center text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Open Notification Center →
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-700">{admin.fullName}</span>
            </div>

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Logout'}</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {dbError && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold">Database connection unavailable</p>
                <p className="mt-0.5 text-rose-700">{dbError}</p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
