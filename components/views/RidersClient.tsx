'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  PowerOff,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { ActionConfirmDialog, Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateShort, formatDateTime, formatLKR } from '@/lib/format';

interface RiderRow {
  id: string;
  user_id: string;
  account_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  vehicle_type: string;
  vehicle_name: string;
  plate_number: string;
  license_number: string;
  is_verified: boolean;
  vehicle_approved: boolean;
  is_online: boolean;
  is_available: boolean;
  driver_state: string;
  operating_city: string;
  active_booking_id: string | null;
  active_service_type: string | null;
  rating: number;
  total_trips: number;
  earnings_lkr: number;
  created_at: string;
}

interface RiderDetailPayload {
  rider: RiderRow & {
    current_lat: number | null;
    current_lng: number | null;
    last_location_at: string | null;
    total_earnings_lkr: number;
    assigned_bookings_count: number;
    member_since: string;
  };
  trips: Array<{
    id: string;
    service_type: string;
    title: string;
    status: string;
    total_paid_lkr: number;
    rider_earnings_lkr: number;
    pickup_address: string;
    destination_address: string;
    customer_name: string;
    created_at: string;
  }>;
  dispatches: Array<{
    id: string;
    booking_id: string;
    distance_km: number;
    status: string;
    service_type: string;
    offered_at: string;
  }>;
  auditHistory: Array<{
    id: string;
    action: string;
    reason: string;
    admin_name: string;
    created_at: string;
  }>;
}

type PendingRiderAction =
  | null
  | {
      action: 'approve' | 'reject' | 'suspend' | 'request_info' | 'restore_available' | 'recalculate';
      title: string;
      description: string;
      confirmLabel: string;
      tone: 'primary' | 'danger' | 'success' | 'warning';
      requireReason: boolean;
    };

export function RidersClient({ initialStatus = 'all' }: { initialStatus?: string }) {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, approved: 0, pending: 0, online: 0, suspended: 0 });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [sort, setSort] = useState('updated_at');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiderDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState<PendingRiderAction>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        vehicleType: vehicleFilter,
        sort,
        order,
      });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/riders?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load riders');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load riders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, vehicleFilter, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/riders/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch rider details');
      setDetail(json);
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Could not load rider', 'error');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitRiderAction(reason: string) {
    if (!selectedId || !actionDialog) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/riders/${selectedId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionDialog.action, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      pushToast('Updated Rider', `Completed "${actionDialog.confirmLabel}" successfully.`, 'success');
      setActionDialog(null);
      await Promise.all([openDetail(selectedId), fetchList()]);
    } catch (err) {
      pushToast('Action Blocked', err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  const columns: TableColumn<RiderRow>[] = [
    {
      key: 'full_name',
      header: 'Rider',
      sortKey: 'full_name',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.full_name}</p>
          <p className="text-xs text-slate-500">
            {r.phone || r.email || r.account_id} · {r.operating_city || 'Unassigned city'}
          </p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle & License',
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">
            {r.vehicle_name}{' '}
            <span className="uppercase text-slate-400">({r.vehicle_type})</span>
          </p>
          <p className="font-mono text-[11px] text-slate-500">
            {r.plate_number}
            {r.license_number ? ` · Lic: ${r.license_number}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'Verification',
      render: (r) =>
        r.is_verified && r.vehicle_approved ? (
          <StatusBadge value="approved" label="Approved" />
        ) : (
          <StatusBadge value="pending" label="Pending Review" />
        ),
    },
    {
      key: 'driver_state',
      header: 'Availability State',
      sortKey: 'driver_state',
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge value={r.driver_state} />
          {r.active_booking_id && (
            <p className="font-mono text-[10px] text-blue-600">{r.active_booking_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'total_trips',
      header: 'Trips & Rating',
      sortKey: 'total_trips',
      render: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800">{r.total_trips} trips</p>
          <p className="inline-flex items-center gap-1 text-slate-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(r.rating).toFixed(2)}
          </p>
        </div>
      ),
    },
    {
      key: 'earnings',
      header: 'Earnings',
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatLKR(r.earnings_lkr)}</span>
      ),
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
        searchPlaceholder="Search rider name, phone, plate number, license or city..."
        filterTabs={[
          { value: 'all', label: 'All Riders', count: counts.total },
          { value: 'pending', label: 'Pending Verification', count: counts.pending },
          { value: 'approved', label: 'Approved', count: counts.approved },
          { value: 'online', label: 'Online', count: counts.online },
          { value: 'on_trip', label: 'Active Trip / Reserved' },
          { value: 'suspended', label: 'Unavailable / Suspended', count: counts.suspended },
        ]}
        activeFilter={statusFilter}
        extraControls={
          <select
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="all">All Vehicle Types</option>
            <option value="bike">Bike / Scooter</option>
            <option value="tuktuk">Tuk-Tuk</option>
            <option value="car">Car / Van</option>
          </select>
        }
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
        title={detail?.rider.full_name || 'Rider Details'}
        subtitle={
          detail
            ? `${detail.rider.vehicle_name} · ${detail.rider.plate_number}`
            : 'Loading rider profile...'
        }
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Verification & Availability Banner */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={detail.rider.driver_state} />
                  {detail.rider.is_verified && detail.rider.vehicle_approved ? (
                    <StatusBadge value="approved" label="Driver & Vehicle Verified" />
                  ) : (
                    <StatusBadge value="pending" label="Verification Pending" />
                  )}
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {detail.rider.account_id}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Total Trips</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {detail.rider.total_trips}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Earnings</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-700">
                    {formatLKR(detail.rider.total_earnings_lkr)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Rating</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    ★ {Number(detail.rider.rating).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/70">
                  <p className="text-slate-500">Operating City</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                    {detail.rider.operating_city || '—'}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                {!(detail.rider.is_verified && detail.rider.vehicle_approved) && (
                  <button
                    type="button"
                    onClick={() =>
                      setActionDialog({
                        action: 'approve',
                        title: 'Approve Rider Verification',
                        description: `Approve ${detail.rider.full_name} (${detail.rider.plate_number}) and notify the rider.`,
                        confirmLabel: 'Approve Rider',
                        tone: 'success',
                        requireReason: false,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve Verification
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setActionDialog({
                      action: 'request_info',
                      title: 'Send Rider Verification Feedback',
                      description:
                        'Send instructions or missing document/license requirements directly to this rider.',
                      confirmLabel: 'Send Feedback',
                      tone: 'primary',
                      requireReason: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Send Feedback
                </button>

                {detail.rider.is_verified && detail.rider.vehicle_approved && (
                  detail.rider.driver_state === 'UNAVAILABLE' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActionDialog({
                          action: 'restore_available',
                          title: 'Restore Rider Availability',
                          description: 'Mark this verified rider Available for incoming dispatches.',
                          confirmLabel: 'Restore Available',
                          tone: 'success',
                          requireReason: false,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Restore Available
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setActionDialog({
                          action: 'suspend',
                          title: 'Suspend / Take Rider Unavailable',
                          description:
                            'Sets rider offline/UNAVAILABLE unless an active trip lock is held.',
                          confirmLabel: 'Suspend Rider',
                          tone: 'warning',
                          requireReason: true,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      <PowerOff className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setActionDialog({
                      action: 'reject',
                      title: 'Reject Rider Application / Documents',
                      description:
                        'Revokes verification, moves rider unavailable, and sends rejection instructions.',
                      confirmLabel: 'Reject Rider',
                      tone: 'danger',
                      requireReason: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActionDialog({
                      action: 'recalculate',
                      title: 'Recalculate Unified Availability',
                      description:
                        'Synchronize driver_state across Rides, Food Delivery & Parcel assignments.',
                      confirmLabel: 'Sync State',
                      tone: 'primary',
                      requireReason: false,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Recalculate State
                </button>
              </div>
            </div>

            {/* Personal, License & Vehicle Information */}
            <div className="rounded-2xl border border-slate-200 p-4 text-xs">
              <h4 className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-500">
                <Bike className="h-3.5 w-3.5" /> Driver & Vehicle Record
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-slate-400">Phone</dt>
                  <dd className="font-medium text-slate-900">{detail.rider.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">License Number</dt>
                  <dd className="font-mono font-medium text-slate-900">
                    {detail.rider.license_number || 'Not submitted'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Vehicle Type & Model</dt>
                  <dd className="font-medium text-slate-900">
                    {detail.rider.vehicle_type.toUpperCase()} · {detail.rider.vehicle_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Plate Number</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {detail.rider.plate_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Last GPS Ping</dt>
                  <dd className="font-medium text-slate-800">
                    {detail.rider.last_location_at
                      ? formatDateTime(detail.rider.last_location_at)
                      : 'Never pinged'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Coordinates</dt>
                  <dd className="flex items-center gap-1 font-mono text-slate-700">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {detail.rider.current_lat != null
                      ? `${detail.rider.current_lat.toFixed(4)}, ${detail.rider.current_lng?.toFixed(4)}`
                      : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Recent Trips */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Trip & Delivery History ({detail.trips.length})
              </h4>
              <div className="mt-2 space-y-2">
                {detail.trips.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    No assigned trips yet.
                  </p>
                ) : (
                  detail.trips.map((t) => (
                    <div key={t.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-800">
                          {t.id} · {t.service_type}
                        </span>
                        <StatusBadge value={t.status} />
                      </div>
                      <p className="mt-1 text-slate-600">
                        {t.pickup_address} → {t.destination_address}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-slate-500">
                        <span>
                          Customer: {t.customer_name} · {formatDateShort(t.created_at)}
                        </span>
                        <span className="font-semibold text-emerald-700">
                          Earned {formatLKR(t.rider_earnings_lkr)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Audit History */}
            {detail.auditHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Admin Review History
                </h4>
                <div className="mt-2 space-y-2">
                  {detail.auditHistory.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{log.action}</span>
                        <span className="text-slate-400">{formatDateTime(log.created_at)}</span>
                      </div>
                      {log.reason && <p className="mt-1 text-slate-600">{log.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ActionConfirmDialog
        open={Boolean(actionDialog)}
        title={actionDialog?.title || ''}
        description={actionDialog?.description || ''}
        confirmLabel={actionDialog?.confirmLabel || 'Confirm'}
        confirmTone={actionDialog?.tone || 'primary'}
        requireReason={actionDialog?.requireReason || false}
        loading={actionBusy}
        onClose={() => setActionDialog(null)}
        onConfirm={submitRiderAction}
      />
    </>
  );
}
