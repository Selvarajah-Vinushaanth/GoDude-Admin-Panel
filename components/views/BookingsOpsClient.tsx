'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  MapPin,
  Package,
  RefreshCw,
  Ban,
  UtensilsCrossed,
  Clock,
  CreditCard,
  User,
  Bike,
  AlertTriangle,
} from 'lucide-react';
import { DataTable, FilterTabOption, TableColumn } from '@/components/ui/DataTable';
import { ActionConfirmDialog, Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateTime, formatLKR } from '@/lib/format';

interface BookingListRow {
  id: string;
  service_type?: string;
  booking_mode?: string;
  trip_type?: 'one_way' | 'return';
  title: string;
  subtitle?: string;
  status: string;
  vehicle_type?: string;
  payment_method: string;
  payment_status: string;
  pickup_address?: string;
  destination_address: string;
  return_pickup_address?: string | null;
  return_destination_address?: string | null;
  return_scheduled_at?: string | null;
  distance_km?: number;
  outbound_distance_km?: number;
  return_distance_km?: number;
  outbound_fare_lkr?: number;
  return_fare_lkr?: number;
  total_paid_lkr: number;
  rider_earnings_lkr?: number;
  platform_commission_lkr?: number;
  created_at: string;
  customer_id?: string;
  customer_account_id?: string;
  customer_name: string;
  customer_phone: string | null;
  driver_account_id?: string | null;
  driver_name: string | null;
  plate_number: string | null;
  restaurant_name?: string | null;
  restaurant_city?: string | null;
  sender_name?: string;
  recipient_name?: string;
  parcel_category?: string;
  weight_kg?: number;
  is_fragile?: boolean;
  lifecycle_stage?: string;
}

interface BookingDetailPayload {
  booking: BookingListRow & {
    customer_email?: string;
    customer_account_id?: string;
    driver_phone?: string | null;
    driver_vehicle_name?: string | null;
    driver_plate?: string | null;
    restaurant_address?: string | null;
    restaurant_phone?: string | null;
    subtotal_lkr: number;
    delivery_or_service_fee_lkr: number;
    discount_lkr: number;
    savings_earned_lkr: number;
    service_fee_lkr: number;
    estimated_distance_km: number;
    actual_distance_km: number;
    elapsed_seconds: number;
    cancelled_reason?: string | null;
    no_driver_reason?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    breadcrumb_count?: number;
    items_summary?: Array<{ name?: string; quantity?: number; lineTotalLKR?: number }>;
  };
  parcelDetails: {
    sender_name: string;
    sender_phone: string;
    pickup_instructions: string;
    recipient_name: string;
    recipient_phone: string;
    delivery_instructions: string;
    parcel_category: string;
    parcel_description: string;
    parcel_count: number;
    weight_kg: number;
    length_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
    is_fragile: boolean;
    handling_precautions: string;
    lifecycle_stage: string;
    pickup_verified_at: string | null;
    delivery_verified_at: string | null;
    failure_reason: string | null;
    return_reason: string | null;
  } | null;
  parcelTimeline: Array<{
    id: string;
    from_stage: string | null;
    to_stage: string;
    actor_name: string;
    actor_role: string;
    notes: string;
    created_at: string;
  }>;
  foodItems: Array<{
    id: string;
    food_name: string;
    quantity: number;
    portion: string;
    spice_level: string;
    selected_addons: Array<{ label?: string; priceLKR?: number }>;
    special_instructions: string;
    unit_total_lkr: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount_lkr: number;
    status: string;
    gateway_ref: string | null;
    refund_amount_lkr: number;
    created_at: string;
  }>;
  dispatches: Array<{
    id: string;
    driver_name: string;
    plate_number: string;
    distance_km: number;
    status: string;
    offered_at: string;
  }>;
}

export function BookingsOpsClient({
  mode,
  initialSearch = '',
  initialStatus = 'all',
}: {
  mode: 'rides' | 'food' | 'parcels';
  initialSearch?: string;
  initialStatus?: string;
}) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<BookingListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const endpoint =
    mode === 'rides' ? '/api/rides' : mode === 'food' ? '/api/food-orders' : '/api/parcels';

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
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);

      const res = await fetch(`${endpoint}?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load bookings');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, statusFilter, dateFrom, dateTo, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load booking details');
      setDetail(json);
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Failed to load booking', 'error');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCancelBooking(reason: string) {
    if (!selectedId) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(selectedId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cancellation failed');
      pushToast('Booking Cancelled', `${selectedId} cancelled and payment updated.`, 'success');
      setCancelOpen(false);
      await Promise.all([openDetail(selectedId), fetchList()]);
    } catch (err) {
      pushToast('Action Failed', err instanceof Error ? err.message : 'Cancellation failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReassignParcel(reason: string) {
    if (!selectedId) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/parcels/${encodeURIComponent(selectedId)}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Reassignment failed');
      pushToast('Parcel Requeued', `Rider cleared and dispatch restarted for ${selectedId}.`, 'success');
      setReassignOpen(false);
      await Promise.all([openDetail(selectedId), fetchList()]);
    } catch (err) {
      pushToast('Reassign Blocked', err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  const filterTabs: FilterTabOption[] =
    mode === 'rides'
      ? [
          { value: 'all', label: 'All Rides', count: counts.total },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'Searching', label: 'Searching' },
          { value: 'On the Way', label: 'In Progress' },
          { value: 'Completed', label: 'Completed', count: counts.completed },
          { value: 'Cancelled', label: 'Cancelled', count: counts.cancelled },
        ]
      : mode === 'food'
        ? [
            { value: 'all', label: 'All Orders', count: counts.total },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'Confirmed', label: 'Confirmed' },
            { value: 'Preparing', label: 'Preparing' },
            { value: 'On the Way', label: 'Out for Delivery' },
            { value: 'Delivered', label: 'Delivered', count: counts.delivered },
            { value: 'Cancelled', label: 'Cancelled', count: counts.cancelled },
          ]
        : [
            { value: 'all', label: 'All Parcels', count: counts.total },
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'Searching', label: 'Searching' },
            { value: 'On the Way', label: 'In Transit' },
            { value: 'Delivered', label: 'Delivered', count: counts.delivered },
            { value: 'Returned to Sender', label: 'Returned' },
            { value: 'Cancelled', label: 'Cancelled' },
          ];

  const columns: TableColumn<BookingListRow>[] = [
    {
      key: 'id',
      header: 'Booking ID',
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs font-semibold text-slate-900">{r.id}</p>
            {r.trip_type === 'return' && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                ⇄ Return Trip
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {mode === 'rides'
              ? `${r.service_type} (${r.booking_mode})`
              : mode === 'food'
                ? r.restaurant_name || 'Kitchen'
                : r.parcel_category || 'Parcel'}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-slate-900">{r.customer_name}</p>
          <p className="text-slate-500">
            {r.customer_phone || '—'}
            {r.customer_account_id ? ` · ${r.customer_account_id}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'route',
      header: mode === 'food' ? 'Restaurant & Drop-off' : 'Route & Entities',
      render: (r) => (
        <div className="max-w-xs text-xs">
          {mode === 'parcels' && r.sender_name && (
            <p className="truncate font-medium text-slate-800">
              {r.sender_name} → {r.recipient_name}{' '}
              {r.is_fragile ? (
                <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">
                  FRAGILE
                </span>
              ) : null}
            </p>
          )}
          <p className="truncate text-slate-600">
            {mode === 'food'
              ? `${r.restaurant_name || ''} → ${r.destination_address}`
              : `${r.pickup_address || ''} → ${r.destination_address}`}
          </p>
        </div>
      ),
    },
    {
      key: 'rider',
      header: 'Assigned Rider',
      render: (r) =>
        r.driver_name ? (
          <div className="text-xs">
            <p className="font-medium text-slate-800">{r.driver_name}</p>
            <p className="font-mono text-[11px] text-slate-500">{r.plate_number}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge value={r.status} />
          {mode === 'parcels' && r.lifecycle_stage && (
            <p className="font-mono text-[10px] text-slate-400">{r.lifecycle_stage}</p>
          )}
        </div>
      ),
    },
    {
      key: 'total_paid_lkr',
      header: 'Amount & Pay',
      sortKey: 'total_paid_lkr',
      align: 'right',
      render: (r) => (
        <div className="text-right text-xs">
          <p className="font-semibold text-slate-900">{formatLKR(r.total_paid_lkr)}</p>
          <p className="text-slate-500">{r.payment_method}</p>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortKey: 'created_at',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
      ),
    },
  ];

  const isTerminal =
    detail?.booking.status === 'Completed' ||
    detail?.booking.status === 'Delivered' ||
    detail?.booking.status === 'Cancelled' ||
    detail?.booking.status === 'Returned to Sender';

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
        searchPlaceholder={
          mode === 'rides'
            ? 'Search ride ID, customer, driver, pickup or drop-off...'
            : mode === 'food'
              ? 'Search order ID, restaurant, customer, or rider...'
              : 'Search parcel ID, sender, recipient, category, or rider...'
        }
        filterTabs={filterTabs}
        activeFilter={statusFilter}
        showDateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
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
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
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
        title={detail?.booking.id || 'Booking Details'}
        subtitle={detail ? `${detail.booking.service_type} · ${detail.booking.title}` : 'Loading...'}
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            {/* Header Status & Actions */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge value={detail.booking.status} />
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200">
                    {detail.booking.payment_status}
                  </span>
                </div>
                <span className="text-slate-500">{formatDateTime(detail.booking.created_at)}</span>
              </div>

              {(detail.booking.cancelled_reason || detail.booking.no_driver_reason) && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {detail.booking.cancelled_reason || detail.booking.no_driver_reason}
                  </span>
                </div>
              )}

              {!isTerminal && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  {mode === 'parcels' && (
                    <button
                      type="button"
                      onClick={() => setReassignOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reassign Rider
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCancelOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancel & Refund
                  </button>
                </div>
              )}
            </div>

            {/* Customer & Assigned Rider */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-3.5">
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                  <User className="h-3.5 w-3.5" /> Customer
                </p>
                <p className="mt-1.5 font-semibold text-slate-900">
                  {detail.booking.customer_name}
                </p>
                <p className="text-slate-500">
                  {detail.booking.customer_phone || detail.booking.customer_email || '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-3.5">
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                  <Bike className="h-3.5 w-3.5" /> Assigned Rider
                </p>
                {detail.booking.driver_name ? (
                  <>
                    <p className="mt-1.5 font-semibold text-slate-900">
                      {detail.booking.driver_name}
                    </p>
                    <p className="text-slate-500">
                      {detail.booking.driver_vehicle_name} ({detail.booking.driver_plate}) ·{' '}
                      {detail.booking.driver_phone || '—'}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-slate-400">No rider assigned</p>
                )}
              </div>
            </div>

            {/* Route & Restaurant */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                <MapPin className="h-3.5 w-3.5" /> Locations & Timestamps
              </p>
              {detail.booking.restaurant_name && (
                <div>
                  <span className="text-slate-400">Restaurant:</span>{' '}
                  <strong className="text-slate-900">{detail.booking.restaurant_name}</strong> (
                  {detail.booking.restaurant_city})
                </div>
              )}
              <div>
                <span className="text-slate-400">Pickup:</span>{' '}
                <span className="font-medium text-slate-800">{detail.booking.pickup_address}</span>
              </div>
              <div>
                <span className="text-slate-400">Destination:</span>{' '}
                <span className="font-medium text-slate-800">
                  {detail.booking.destination_address}
                </span>
              </div>
              {detail.booking.trip_type === 'return' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 text-blue-900">
                  <p className="font-bold">⇄ Return Trip Journey</p>
                  <p className="mt-1">
                    Return Leg:{' '}
                    {detail.booking.return_pickup_address || detail.booking.destination_address} →{' '}
                    {detail.booking.return_destination_address || detail.booking.pickup_address}
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Outbound: {detail.booking.outbound_distance_km ?? detail.booking.estimated_distance_km} km (
                    {formatLKR(detail.booking.outbound_fare_lkr ?? 0)}) · Return:{' '}
                    {detail.booking.return_distance_km ?? 0} km (
                    {formatLKR(detail.booking.return_fare_lkr ?? 0)})
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-2 text-slate-500">
                <span>Est. Distance: {detail.booking.estimated_distance_km} km</span>
                <span>GPS Distance: {detail.booking.actual_distance_km} km</span>
                <span>Breadcrumbs: {detail.booking.breadcrumb_count ?? 0} pts</span>
                {detail.booking.started_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Started {formatDateTime(detail.booking.started_at)}
                  </span>
                )}
                {detail.booking.completed_at && (
                  <span>Completed {formatDateTime(detail.booking.completed_at)}</span>
                )}
              </div>
            </div>

            {/* Food Order Items */}
            {detail.foodItems.length > 0 && (
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Ordered Food Items ({detail.foodItems.length})
                </p>
                <div className="mt-2.5 divide-y divide-slate-100">
                  {detail.foodItems.map((fi) => (
                    <div key={fi.id} className="flex items-start justify-between py-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {fi.quantity}× {fi.food_name} ({fi.portion})
                        </p>
                        <p className="text-slate-500">
                          Spice: {fi.spice_level}
                          {Array.isArray(fi.selected_addons) && fi.selected_addons.length > 0
                            ? ` · Add-ons: ${fi.selected_addons.map((a) => a.label).join(', ')}`
                            : ''}
                        </p>
                        {fi.special_instructions && (
                          <p className="mt-0.5 text-amber-700">Note: {fi.special_instructions}</p>
                        )}
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatLKR(fi.unit_total_lkr * fi.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parcel Delivery Specifics */}
            {detail.parcelDetails && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                    <Package className="h-3.5 w-3.5" /> Parcel Manifest & Custody
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-slate-400">Sender</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.parcelDetails.sender_name} ({detail.parcelDetails.sender_phone})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Recipient</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.parcelDetails.recipient_name} ({detail.parcelDetails.recipient_phone})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Category & Count</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.parcelDetails.parcel_category} · {detail.parcelDetails.parcel_count} pkg
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Weight & Handling</dt>
                      <dd className="font-medium text-slate-900">
                        {detail.parcelDetails.weight_kg} kg
                        {detail.parcelDetails.is_fragile ? ' · FRAGILE' : ''}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2.5 text-slate-600">
                    <strong>Description:</strong> {detail.parcelDetails.parcel_description}
                  </p>
                  {(detail.parcelDetails.failure_reason || detail.parcelDetails.return_reason) && (
                    <p className="mt-2 font-medium text-rose-700">
                      Issue Note: {detail.parcelDetails.failure_reason || detail.parcelDetails.return_reason}
                    </p>
                  )}
                </div>

                {detail.parcelTimeline.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-semibold uppercase tracking-wider text-slate-400">
                      Parcel Lifecycle Timeline
                    </p>
                    <div className="mt-2.5 space-y-2">
                      {detail.parcelTimeline.map((step) => (
                        <div key={step.id} className="flex items-start justify-between gap-2 border-l-2 border-blue-200 pl-3">
                          <div>
                            <p className="font-semibold text-slate-800">{step.to_stage}</p>
                            <p className="text-slate-500">
                              {step.actor_name} ({step.actor_role})
                              {step.notes ? ` · ${step.notes}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatDateTime(step.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fare & Financial Summary */}
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
                <CreditCard className="h-3.5 w-3.5" /> Fare & Financial Breakdown
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>{mode === 'food' ? 'Food Subtotal' : 'Subtotal'}</span>
                  <span>{formatLKR(detail.booking.subtotal_lkr)}</span>
                </div>
                {mode === 'food' ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee</span>
                      <span>{formatLKR(detail.booking.delivery_or_service_fee_lkr)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Service Fee (10% of Delivery Fee)</span>
                      <span>{formatLKR(detail.booking.service_fee_lkr)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery / Service Fee</span>
                    <span>
                      {formatLKR(
                        detail.booking.delivery_or_service_fee_lkr + detail.booking.service_fee_lkr
                      )}
                    </span>
                  </div>
                )}
                {detail.booking.discount_lkr > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Promo Discount</span>
                    <span>-{formatLKR(detail.booking.discount_lkr)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                  <span>Total Paid ({detail.booking.payment_method})</span>
                  <span>{formatLKR(detail.booking.total_paid_lkr)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Rider Earnings / Platform Commission</span>
                  <span>
                    {formatLKR(detail.booking.rider_earnings_lkr)} /{' '}
                    {formatLKR(detail.booking.platform_commission_lkr)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <ActionConfirmDialog
        open={cancelOpen}
        title="Cancel Booking & Issue Refund"
        description={`Cancel ${selectedId}, release any assigned rider lock, refund verified payment records, and notify the customer.`}
        confirmLabel="Confirm Cancellation"
        confirmTone="danger"
        requireReason
        loading={actionBusy}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancelBooking}
      />

      <ActionConfirmDialog
        open={reassignOpen}
        title="Reassign Parcel to Another Rider"
        description={`Unassign the current rider for ${selectedId} and requeue dispatch search for nearby eligible riders.`}
        confirmLabel="Reassign Parcel"
        confirmTone="primary"
        requireReason={false}
        loading={actionBusy}
        onClose={() => setReassignOpen(false)}
        onConfirm={handleReassignParcel}
      />
    </>
  );
}
