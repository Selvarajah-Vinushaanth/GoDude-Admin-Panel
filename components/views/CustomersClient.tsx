'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Landmark, Star, Wallet, Bell } from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateShort, formatDateTime, formatLKR } from '@/lib/format';

interface CustomerRow {
  id: string;
  account_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
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

export function CustomersClient({ initialSearch = '' }: { initialSearch?: string }) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState('customer');
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
      header: 'Customer',
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
      header: 'Role',
      render: (r) => <StatusBadge value={r.role} />,
    },
    {
      key: 'activity',
      header: 'Orders & Trips',
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
          { value: 'customer', label: 'Customers Only' },
          { value: 'all', label: 'All Platform Users' },
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
        title={detail?.customer.full_name || 'Customer Profile'}
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
            {/* Contact & Account Status Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge value={detail.customer.role} />
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
            </div>

            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
              {(
                [
                  ['overview', 'Profile & Resources'],
                  ['rides', `Rides (${rideHistory.length})`],
                  ['food', `Food (${foodHistory.length})`],
                  ['parcels', `Parcels (${parcelHistory.length})`],
                  ['finance', `Payments & Savings (${detail.payments.length})`],
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
                    <Wallet className="h-3.5 w-3.5" /> 10% Savings Ledger
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
