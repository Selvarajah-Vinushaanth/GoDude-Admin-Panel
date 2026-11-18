'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShieldAlert,
  Store,
  MapPin,
  Clock,
  Phone,
  UtensilsCrossed,
  Star,
} from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { ActionConfirmDialog, Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateShort, formatDateTime, formatLKR } from '@/lib/format';

interface RestaurantRow {
  id: string;
  name: string;
  tagline: string;
  city: string;
  address: string;
  approval_status: string;
  store_status: string;
  is_open: boolean;
  rating: number;
  review_count: number;
  delivery_time_mins: number;
  delivery_fee_lkr: number;
  commission_pct: number;
  contact_phone: string;
  rejection_reason: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  menu_count: number;
  orders_count: number;
  created_at: string;
}

interface RestaurantDetailPayload {
  restaurant: RestaurantRow & {
    lat: number;
    lng: number;
    delivery_radius_km: number;
    min_order_lkr: number;
    prep_time_mins: number;
    logo_url: string;
    cover_url: string;
    operating_hours: {
      open?: string;
      close?: string;
      timezone?: string;
    } | null;
    owner_id: string | null;
    owner_account_id: string | null;
  };
  menuItems: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    price_lkr: number;
    promo_price_lkr: number | null;
    is_available: boolean;
    is_popular: boolean;
    is_spicy: boolean;
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    total_paid_lkr: number;
    customer_name: string;
    created_at: string;
  }>;
  approvalHistory: Array<{
    id: string;
    action: string;
    reason: string;
    admin_name: string;
    created_at: string;
  }>;
  notificationsHistory: Array<{
    id: string;
    event_type: string;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
  }>;
}

type ReviewActionState =
  | null
  | {
      decision: 'approved' | 'rejected' | 'suspended' | 'request_info';
      title: string;
      description: string;
      confirmLabel: string;
      tone: 'primary' | 'danger' | 'success' | 'warning';
      requireReason: boolean;
    };

export function RestaurantsClient({
  initialStatus = 'all',
  initialInspect = '',
}: {
  initialStatus?: string;
  initialInspect?: string;
}) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    openNow: 0,
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(initialInspect || null);
  const [detail, setDetail] = useState<RestaurantDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'application' | 'menu' | 'orders' | 'history'>('application');

  const [reviewAction, setReviewAction] = useState<ReviewActionState>(null);
  const [commissionPct, setCommissionPct] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        sort,
        order,
      });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/restaurants?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load restaurants');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  const openDetail = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailTab('application');
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/restaurants/${id}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load restaurant');
        setDetail(json);
        setCommissionPct(
          json.restaurant?.commission_pct != null ? String(json.restaurant.commission_pct) : ''
        );
      } catch (err) {
        pushToast('Error', err instanceof Error ? err.message : 'Could not load restaurant', 'error');
        setSelectedId(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    if (!initialInspect) return;
    const t = setTimeout(() => {
      void openDetail(initialInspect);
    }, 0);
    return () => clearTimeout(t);
  }, [initialInspect, openDetail]);

  async function submitReview(reason: string) {
    if (!selectedId || !reviewAction) return;
    setActionBusy(true);
    try {
      const trimmedComm = commissionPct.trim();
      const comm = trimmedComm !== '' ? Number(trimmedComm) : NaN;
      const res = await fetch(`/api/restaurants/${selectedId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: reviewAction.decision,
          reason,
          commissionPct: Number.isFinite(comm) && comm >= 0 && comm <= 50 ? comm : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Review update failed');
      pushToast(
        'Restaurant Updated',
        `Workflow updated & owner notification dispatched.`,
        'success'
      );
      setReviewAction(null);
      await Promise.all([openDetail(selectedId), fetchList()]);
    } catch (err) {
      pushToast('Failed', err instanceof Error ? err.message : 'Review update failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleOpen(restaurantId: string, nextOpen: boolean) {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextOpen }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Toggle failed');
      pushToast(
        nextOpen ? 'Store Opened' : 'Store Closed',
        `Kitchen availability updated live.`,
        'success'
      );
      await Promise.all([openDetail(restaurantId), fetchList()]);
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Toggle failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  const columns: TableColumn<RestaurantRow>[] = [
    {
      key: 'name',
      header: 'Restaurant',
      sortKey: 'name',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">
            {r.city} · {r.menu_count} dishes · {r.orders_count} orders
          </p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner & Contact',
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{r.owner_name || 'Platform Catalog'}</p>
          <p className="text-slate-500">{r.owner_phone || r.contact_phone || 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'approval_status',
      header: 'Approval',
      sortKey: 'approval_status',
      render: (r) => <StatusBadge value={r.approval_status} />,
    },
    {
      key: 'store_status',
      header: 'Store Status',
      render: (r) => <StatusBadge value={r.store_status} />,
    },
    {
      key: 'rating',
      header: 'Rating & Fee',
      sortKey: 'rating',
      render: (r) => (
        <div className="text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(r.rating).toFixed(1)} ({r.review_count})
          </span>
          <p className="text-slate-500">{r.commission_pct}% comm.</p>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Submitted',
      sortKey: 'created_at',
      align: 'right',
      render: (r) => <span className="text-xs text-slate-500">{formatDateShort(r.created_at)}</span>,
    },
  ];

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
        searchPlaceholder="Search restaurant name, city, address, or owner..."
        filterTabs={[
          { value: 'all', label: 'All Kitchens', count: counts.total },
          { value: 'pending', label: 'Pending Approvals', count: counts.pending },
          { value: 'approved', label: 'Approved', count: counts.approved },
          { value: 'rejected', label: 'Rejected', count: counts.rejected },
          { value: 'suspended', label: 'Suspended', count: counts.suspended },
        ]}
        activeFilter={statusFilter}
        sort={sort}
        order={order}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        onFilterChange={(val) => {
          setStatusFilter(val);
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
        title={detail?.restaurant.name || 'Restaurant Review'}
        subtitle={
          detail
            ? `${detail.restaurant.city} · ${detail.restaurant.address}`
            : 'Loading restaurant application...'
        }
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Decision & Store Control Box */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge value={detail.restaurant.approval_status} />
                  <StatusBadge value={detail.restaurant.store_status} />
                </div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() =>
                    handleToggleOpen(detail.restaurant.id, !detail.restaurant.is_open)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {detail.restaurant.is_open ? 'Force Close Kitchen' : 'Mark Kitchen Open'}
                </button>
              </div>

              {detail.restaurant.rejection_reason && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <strong>Latest Review Note:</strong> {detail.restaurant.rejection_reason}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setReviewAction({
                      decision: 'approved',
                      title: 'Approve Restaurant Application',
                      description: `Approve "${detail.restaurant.name}" so customers can browse and place orders immediately.`,
                      confirmLabel: 'Approve Kitchen',
                      tone: 'success',
                      requireReason: false,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReviewAction({
                      decision: 'request_info',
                      title: 'Request Additional Information',
                      description:
                        'Send clear instructions to the restaurant owner while keeping the application under review.',
                      confirmLabel: 'Send Request & Notify',
                      tone: 'primary',
                      requireReason: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Request Info
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReviewAction({
                      decision: 'rejected',
                      title: 'Reject Restaurant Application',
                      description:
                        'Reject this restaurant and deliver the rejection reason to the restaurant owner.',
                      confirmLabel: 'Reject Application',
                      tone: 'danger',
                      requireReason: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>

                {detail.restaurant.approval_status !== 'suspended' && (
                  <button
                    type="button"
                    onClick={() =>
                      setReviewAction({
                        decision: 'suspended',
                        title: 'Suspend Restaurant Operations',
                        description:
                          'Suspends the kitchen from GoDude Foods and closes ordering.',
                        confirmLabel: 'Suspend Kitchen',
                        tone: 'warning',
                        requireReason: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
              {(
                [
                  ['application', 'Application & Owner'],
                  ['menu', `Menu (${detail.menuItems.length})`],
                  ['orders', `Recent Orders (${detail.recentOrders.length})`],
                  ['history', `Approval History (${detail.approvalHistory.length})`],
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

            {detailTab === 'application' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4 text-xs">
                  <h4 className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-500">
                    <Store className="h-3.5 w-3.5" /> Business & Operations
                  </h4>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-slate-400">Restaurant ID</dt>
                      <dd className="font-mono font-medium text-slate-800">{detail.restaurant.id}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Contact Phone</dt>
                      <dd className="flex items-center gap-1 font-medium text-slate-900">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {detail.restaurant.contact_phone || detail.restaurant.owner_phone || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Operating Hours</dt>
                      <dd className="flex items-center gap-1 font-medium text-slate-900">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {detail.restaurant.operating_hours?.open || '06:00'} –{' '}
                        {detail.restaurant.operating_hours?.close || '23:30'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">GPS Coordinates</dt>
                      <dd className="flex items-center gap-1 font-mono text-slate-700">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {detail.restaurant.lat.toFixed(4)}, {detail.restaurant.lng.toFixed(4)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Coverage & Min Order</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.restaurant.delivery_radius_km} km · Min{' '}
                        {formatLKR(detail.restaurant.min_order_lkr)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Prep Time & Commission</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.restaurant.prep_time_mins} mins · {detail.restaurant.commission_pct}%
                      </dd>
                    </div>
                  </dl>
                  {(detail.restaurant.logo_url || detail.restaurant.cover_url) && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="font-semibold text-slate-700">Submitted Media / Documents</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-blue-600">
                        {detail.restaurant.logo_url && (
                          <a
                            href={detail.restaurant.logo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View Logo Asset
                          </a>
                        )}
                        {detail.restaurant.cover_url && (
                          <a
                            href={detail.restaurant.cover_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            View Cover Asset
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-xs">
                  <h4 className="font-semibold uppercase tracking-wider text-slate-500">
                    Restaurant Owner Information
                  </h4>
                  {detail.restaurant.owner_id ? (
                    <dl className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-slate-400">Owner Name</dt>
                        <dd className="font-semibold text-slate-900">
                          {detail.restaurant.owner_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Account ID</dt>
                        <dd className="font-mono text-slate-700">
                          {detail.restaurant.owner_account_id}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Owner Phone</dt>
                        <dd className="text-slate-900">{detail.restaurant.owner_phone || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Owner Email</dt>
                        <dd className="truncate text-slate-900">
                          {detail.restaurant.owner_email || '—'}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-slate-500">
                      Platform-seeded restaurant (not yet claimed by a merchant partner account).
                    </p>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'menu' && (
              <div className="space-y-2.5">
                {detail.menuItems.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No menu items added yet.
                  </p>
                ) : (
                  detail.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600" />
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {item.category}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-500">{item.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-slate-900">
                          {formatLKR(item.promo_price_lkr ?? item.price_lkr)}
                        </p>
                        {item.promo_price_lkr != null && (
                          <p className="text-[10px] text-slate-400 line-through">
                            {formatLKR(item.price_lkr)}
                          </p>
                        )}
                        <StatusBadge
                          value={item.is_available ? 'OPEN' : 'CLOSED'}
                          label={item.is_available ? 'Available' : 'Unavailable'}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'orders' && (
              <div className="space-y-2">
                {detail.recentOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No food orders placed at this restaurant yet.
                  </p>
                ) : (
                  detail.recentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-semibold text-slate-800">{ord.id}</p>
                        <p className="text-slate-500">
                          {ord.customer_name} · {formatDateTime(ord.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{formatLKR(ord.total_paid_lkr)}</p>
                        <StatusBadge value={ord.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'history' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Admin Review Log
                  </h4>
                  <div className="mt-2 space-y-2">
                    {detail.approvalHistory.length === 0 ? (
                      <p className="text-xs text-slate-400">No review actions recorded yet.</p>
                    ) : (
                      detail.approvalHistory.map((h) => (
                        <div key={h.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>{h.action}</span>
                            <span className="text-slate-400">{formatDateTime(h.created_at)}</span>
                          </div>
                          {h.reason && <p className="mt-1 text-slate-600">{h.reason}</p>}
                          <p className="mt-1 text-[11px] text-slate-400">By {h.admin_name}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Owner Notifications Dispatched
                  </h4>
                  <div className="mt-2 space-y-2">
                    {detail.notificationsHistory.length === 0 ? (
                      <p className="text-xs text-slate-400">No notifications recorded.</p>
                    ) : (
                      detail.notificationsHistory.map((n) => (
                        <div key={n.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <div className="flex justify-between font-semibold text-slate-900">
                            <span>{n.title}</span>
                            <span className="text-slate-400">{formatDateTime(n.created_at)}</span>
                          </div>
                          <p className="mt-1 text-slate-600">{n.body}</p>
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

      <ActionConfirmDialog
        open={Boolean(reviewAction)}
        title={reviewAction?.title || ''}
        description={reviewAction?.description || ''}
        confirmLabel={reviewAction?.confirmLabel || 'Confirm'}
        confirmTone={reviewAction?.tone || 'primary'}
        requireReason={reviewAction?.requireReason || false}
        reasonLabel="Feedback / Rejection Reason / Instructions"
        loading={actionBusy}
        onClose={() => setReviewAction(null)}
        onConfirm={submitReview}
      >
        {reviewAction?.decision === 'approved' && (
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Platform Commission % (0–50%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        )}
      </ActionConfirmDialog>
    </>
  );
}
