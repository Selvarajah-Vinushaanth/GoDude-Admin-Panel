'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Landmark, Star, Wallet, Bell, Bike, Store, AlertCircle } from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateShort, formatDateTime, formatLKR } from '@/lib/format';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

interface CustomerRow {
  id: string;
  account_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  effective_roles: Array<'customer' | 'driver' | 'merchant' | 'admin'>;
  onboarding_pending_role: 'driver' | 'merchant' | null;
  has_driver_profile: boolean;
  driver_id: string | null;
  driver_plate: string | null;
  has_restaurant_profile: boolean;
  restaurants_owned_count: number;
  rating: number;
  total_ratings: number;
  member_since: string;
  rides_count: number;
  food_orders_count: number;
  parcels_count: number;
  total_spent_lkr: number;
  created_at: string;
}

interface CustomerDetailPayload {
  customer: CustomerRow & {
    notifications_enabled: boolean;
    location_consent_enabled: boolean;
    selected_location_id: string;
  };
  summary: {
    rides_count: number;
    food_orders_count: number;
    parcels_count: number;
    total_bookings_count: number;
    completed_spend_lkr: number;
    refunded_total_lkr: number;
    payments_count: number;
  };
  driverProfile: {
    id: string;
    vehicle_type: string;
    vehicle_name: string;
    plate_number: string;
    is_verified: boolean;
    vehicle_approved: boolean;
    driver_state: string;
    operating_city: string;
    rating: number;
    total_trips: number;
    total_earnings_lkr: number;
  } | null;
  ownedRestaurants: Array<{
    id: string;
    name: string;
    city: string;
    approval_status: string;
    store_status: string;
    rating: number;
  }>;
  relatedAccountsByEmail: Array<{
    id: string;
    account_id: string;
    full_name: string;
    phone: string | null;
    role: string;
  }>;
  savedAddresses: Array<{
    id: string;
    label: string;
    address_line: string;
    city: string;
    landmark: string;
  }>;
  bankAccounts: Array<{
    id: string;
    bank_name: string;
    branch_name: string;
    account_holder: string;
    account_number_masked: string;
  }>;
  bookings: Array<{
    id: string;
    service_type: string;
    title: string;
    subtitle: string;
    status: string;
    total_paid_lkr: number;
    payment_method: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    booking_id: string;
    method: string;
    amount_lkr: number;
    status: string;
    refund_amount_lkr: number;
    created_at: string;
  }>;
  savingsLedger: Array<{
    id: string;
    type: string;
    title: string;
    amount_lkr: number;
    tx_date: string;
    status: string;
  }>;
}

function roleLabel(role: string): string {
  if (role === 'driver') return 'Rider';
  if (role === 'merchant') return 'Merchant';
  if (role === 'admin') return 'Admin';
  return 'Customer';
}

export function CustomersClient({
  initialSearch = '',
  initialRole = 'customer',
}: {
  initialSearch?: string;
  initialRole?: string;
}) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    customers: 0,
    all: 0,
    drivers: 0,
    merchants: 0,
    dual: 0,
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState(initialRole || 'customer');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'rides' | 'food' | 'parcels' | 'finance'>('overview');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        role: roleFilter,
        sort,
        order,
      });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/customers?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load customers');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  useRealtimeRefresh(['bookings', 'riders', 'restaurants'], () => {
    fetchList();
  });

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailTab('overview');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch profile');
      setDetail(json);
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Could not load profile', 'error');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns: TableColumn<CustomerRow>[] = [
    {
      key: 'full_name',
      header: 'Account',
      sortKey: 'full_name',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.full_name}</p>
          <p className="font-mono text-[11px] text-slate-400">{r.account_id}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{r.phone || '—'}</p>
          <p className="max-w-[190px] truncate text-slate-500">{r.email || 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Authoritative Roles',
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          {(r.effective_roles?.length ? r.effective_roles : [r.role]).map((tag) => (
            <StatusBadge key={tag} value={tag} label={roleLabel(tag)} />
          ))}
          {r.onboarding_pending_role && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
              {r.onboarding_pending_role === 'driver' ? 'Rider setup incomplete' : 'Store setup incomplete'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Customer Orders & Trips',
      render: (r) => (
        <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {r.rides_count} Rides
          </span>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            {r.food_orders_count} Food
          </span>
          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
            {r.parcels_count} Parcels
          </span>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      sortKey: 'rating',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {Number(r.rating).toFixed(1)}
        </span>
      ),
    },
    {
      key: 'spent',
      header: 'Completed Spend',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatLKR(r.total_spent_lkr)}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortKey: 'created_at',
      align: 'right',
      render: (r) => <span className="text-xs text-slate-500">{formatDateShort(r.created_at)}</span>,
    },
  ];

  const rideHistory =
    detail?.bookings.filter((b) => b.service_type === 'Ride Booking' || b.service_type === 'Flexible Ride') || [];
  const foodHistory = detail?.bookings.filter((b) => b.service_type === 'Food Delivery') || [];
  const parcelHistory = detail?.bookings.filter((b) => b.service_type === 'Parcel Delivery') || [];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        error={error}
        search={search}
        searchPlaceholder="Search by name, phone, email, or account ID..."
        filterTabs={[
          { value: 'customer', label: 'Customers', count: counts.customers },
          { value: 'all', label: 'All Platform Users', count: counts.all },
          { value: 'driver', label: 'Riders', count: counts.drivers },
          { value: 'merchant', label: 'Merchants', count: counts.merchants },
          { value: 'dual', label: 'Multi-Role', count: counts.dual },
        ]}
        activeFilter={roleFilter}
        sort={sort}
        order={order}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        onFilterChange={(val) => {
          setRoleFilter(val);
          setPage(1);
        }}
        onSortChange={(key) => {
          if (sort === key) setOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
          else {
            setSort(key);
            setOrder('DESC');
          }
        }}
        onPageChange={setPage}
        onRetry={fetchList}
        onRowClick={(row) => openDetail(row.id)}
      />

      <Drawer
        open={Boolean(selectedId)}
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
        }}
        title={detail?.customer.full_name || 'Account Profile'}
        subtitle={
          detail
            ? `${detail.customer.account_id} · Joined ${formatDateShort(detail.customer.created_at)}`
            : 'Loading profile...'
        }
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Contact & Authoritative Account Roles Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(detail.customer.effective_roles?.length
                    ? detail.customer.effective_roles
                    : [detail.customer.role]
                  ).map((tag) => (
                    <StatusBadge key={tag} value={tag} label={roleLabel(tag)} />
                  ))}
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    ★ {Number(detail.customer.rating).toFixed(2)} ({detail.customer.total_ratings} reviews)
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Member since {detail.customer.member_since}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{detail.customer.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{detail.customer.email || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Notifications: {detail.customer.notifications_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Location Consent: {detail.customer.location_consent_enabled ? 'Granted' : 'Off'}
                  </span>
                </div>
              </div>

              {/* Authoritative Financial Totals */}
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-xs">
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Total Bookings</p>
                  <p className="mt-0.5 font-bold text-slate-900">
                    {detail.summary?.total_bookings_count ?? detail.bookings.length}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Completed Spend</p>
                  <p className="mt-0.5 font-bold text-emerald-700">
                    {formatLKR(detail.summary?.completed_spend_lkr ?? detail.customer.total_spent_lkr)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Refunded</p>
                  <p className="mt-0.5 font-bold text-rose-700">
                    {formatLKR(detail.summary?.refunded_total_lkr ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Linked Rider Profile (for multi-role Customer + Rider users) */}
            {detail.driverProfile && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-blue-900">
                    <Bike className="h-4 w-4 text-blue-600" />
                    <span>Linked Rider Profile</span>
                  </div>
                  <Link
                    href={`/riders?search=${encodeURIComponent(detail.customer.account_id)}`}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    Open in Riders →
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
                  <span className="font-medium">
                    {detail.driverProfile.vehicle_name} ({detail.driverProfile.vehicle_type.toUpperCase()})
                  </span>
                  <span className="font-mono text-slate-500">· {detail.driverProfile.plate_number}</span>
                  <StatusBadge value={detail.driverProfile.driver_state} />
                </div>
                <p className="mt-1.5 text-slate-600">
                  {detail.driverProfile.total_trips} trips · ★ {Number(detail.driverProfile.rating).toFixed(2)} ·
                  Earnings: <strong>{formatLKR(detail.driverProfile.total_earnings_lkr)}</strong>
                </p>
              </div>
            )}

            {/* Linked Owned Restaurants (for multi-role Customer + Merchant users) */}
            {detail.ownedRestaurants && detail.ownedRestaurants.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <Store className="h-4 w-4 text-emerald-600" />
                  <span>Owned Restaurants ({detail.ownedRestaurants.length})</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {detail.ownedRestaurants.map((rest) => (
                    <div key={rest.id} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/restaurants?inspect=${encodeURIComponent(rest.id)}`}
                        className="font-medium text-emerald-800 hover:underline"
                      >
                        {rest.name} ({rest.city})
                      </Link>
                      <StatusBadge value={rest.approval_status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Same-Email Separate Accounts Notice (transparency without destructive auto-merging) */}
            {detail.relatedAccountsByEmail && detail.relatedAccountsByEmail.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">Other Accounts Sharing This Email</p>
                    <p className="mt-0.5 text-amber-800">
                      Distinct phone-verified accounts exist with the same email address:
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {detail.relatedAccountsByEmail.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => openDetail(acc.id)}
                          className="block text-left font-mono text-[11px] font-semibold text-amber-950 underline"
                        >
                          {acc.full_name} ({acc.account_id}) · {acc.phone || 'No phone'} · {acc.role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
              {(
                [
                  ['overview', 'Profile & Resources'],
                  ['rides', `Rides (${detail.summary?.rides_count ?? rideHistory.length})`],
                  ['food', `Food (${detail.summary?.food_orders_count ?? foodHistory.length})`],
                  ['parcels', `Parcels (${detail.summary?.parcels_count ?? parcelHistory.length})`],
                  ['finance', `Payments & Savings (${detail.summary?.payments_count ?? detail.payments.length})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDetailTab(k)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    detailTab === k
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="space-y-5">
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <MapPin className="h-3.5 w-3.5" /> Saved Delivery Addresses ({detail.savedAddresses.length})
                  </h4>
                  {detail.savedAddresses.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      No saved addresses registered.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {detail.savedAddresses.map((addr) => (
                        <div key={addr.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700">
                            {addr.label}
                          </span>
                          <p className="mt-1 font-medium text-slate-800">{addr.address_line}</p>
                          <p className="text-slate-500">
                            {addr.city}
                            {addr.landmark ? ` · Near ${addr.landmark}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Landmark className="h-3.5 w-3.5" /> Linked Bank Accounts ({detail.bankAccounts.length})
                  </h4>
                  {detail.bankAccounts.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      No bank accounts linked.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {detail.bankAccounts.map((bank) => (
                        <div key={bank.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <p className="font-semibold text-slate-900">
                            {bank.bank_name} · {bank.branch_name}
                          </p>
                          <p className="text-slate-500">
                            {bank.account_holder} · {bank.account_number_masked}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(detailTab === 'rides' || detailTab === 'food' || detailTab === 'parcels') && (
              <div className="space-y-2.5">
                {(detailTab === 'rides'
                  ? rideHistory
                  : detailTab === 'food'
                    ? foodHistory
                    : parcelHistory
                ).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No bookings recorded in this category yet.
                  </p>
                ) : (
                  (detailTab === 'rides'
                    ? rideHistory
                    : detailTab === 'food'
                      ? foodHistory
                      : parcelHistory
                  ).map((b) => (
                    <div key={b.id} className="rounded-xl border border-slate-200 p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-800">{b.id}</span>
                        <StatusBadge value={b.status} />
                      </div>
                      <p className="mt-1 font-medium text-slate-900">{b.title}</p>
                      <p className="text-slate-500">{b.subtitle}</p>
                      <div className="mt-2 flex items-center justify-between text-slate-500">
                        <span>{formatDateTime(b.created_at)} · {b.payment_method}</span>
                        <span className="font-bold text-slate-900">{formatLKR(b.total_paid_lkr)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'finance' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Payment Transactions
                  </h4>
                  <div className="mt-2 space-y-2">
                    {detail.payments.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No transactions found.
                      </p>
                    ) : (
                      detail.payments.map((pt) => (
                        <div
                          key={pt.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
                        >
                          <div>
                            <p className="font-mono font-semibold text-slate-800">{pt.booking_id}</p>
                            <p className="text-slate-500">
                              {pt.method} · {formatDateTime(pt.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">{formatLKR(pt.amount_lkr)}</p>
                            <StatusBadge value={pt.status} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <Wallet className="h-3.5 w-3.5" /> Savings Ledger
                  </h4>
                  <div className="mt-2 space-y-2">
                    {detail.savingsLedger.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No savings ledger entries.
                      </p>
                    ) : (
                      detail.savingsLedger.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{tx.title}</p>
                            <p className="text-slate-500">{tx.tx_date} · {tx.type}</p>
                          </div>
                          <span
                            className={`font-bold ${
                              tx.amount_lkr >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.amount_lkr >= 0 ? '+' : ''}
                            {formatLKR(tx.amount_lkr)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
