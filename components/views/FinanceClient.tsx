'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, ArrowDownLeft, Percent, ShieldCheck, Download } from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateTime, formatLKR, formatNumber } from '@/lib/format';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

interface TransactionRow {
  id: string;
  booking_id: string;
  method: string;
  amount_lkr: number;
  currency: string;
  gateway_ref: string | null;
  status: string;
  refund_amount_lkr: number;
  refunded_at: string | null;
  created_at: string;
  service_type: string;
  booking_status: string;
  booking_title: string;
  platform_commission_lkr: number;
  rider_earnings_lkr: number;
  customer_name: string;
  customer_phone: string | null;
  account_id: string;
}

interface TransactionDetail extends TransactionRow {
  pickup_address: string;
  destination_address: string;
  subtotal_lkr: number;
  delivery_or_service_fee_lkr: number;
  discount_lkr: number;
  total_paid_lkr: number;
  savings_earned_lkr: number;
  webhook_event_id: string | null;
  raw_payload: Record<string, unknown>;
}

export function FinanceClient() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    totalCount: 0,
    verifiedLKR: 0,
    completedRevenueLKR: 0,
    authorizedLKR: 0,
    pendingLKR: 0,
    voidedCount: 0,
    refundedLKR: 0,
    failedCount: 0,
    commissionLKR: 0,
    riderEarningsLKR: 0,
  });
  const [byService, setByService] = useState<
    Array<{
      serviceType: string;
      txCount: number;
      verifiedLKR: number;
      completedRevenueLKR: number;
      refundedLKR: number;
      commissionLKR: number;
    }>
  >([]);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<TransactionDetail | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        serviceType: serviceFilter,
        sort,
        order,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);

      const res = await fetch(`/api/finance?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load financial records');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.summary) setSummary(json.summary);
      if (json.byService) setByService(json.byService);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, serviceFilter, dateFrom, dateTo, sort, order, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  useRealtimeRefresh(['payments', 'bookings'], () => {
    fetchList();
  });

  async function inspectTx(id: string) {
    try {
      const res = await fetch(`/api/finance/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load transaction');
      setDetail(json.transaction);
    } catch (err) {
      pushToast('Error', err instanceof Error ? err.message : 'Load failed', 'error');
    }
  }

  const columns: TableColumn<TransactionRow>[] = [
    {
      key: 'booking_id',
      header: 'Booking & Gateway Ref',
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-semibold text-slate-900">{r.booking_id}</p>
          <p className="font-mono text-[11px] text-slate-400">
            {r.gateway_ref || r.id.slice(0, 8)}
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
          <p className="text-slate-500">{r.customer_phone || r.account_id}</p>
        </div>
      ),
    },
    {
      key: 'service_type',
      header: 'Service & Method',
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-slate-800">{r.service_type}</p>
          <p className="text-slate-500">{r.method}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Payment Status',
      sortKey: 'status',
      render: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: 'amount_lkr',
      header: 'Amount',
      sortKey: 'amount_lkr',
      align: 'right',
      render: (r) => (
        <div className="text-right text-xs">
          <p className="font-bold text-slate-900">{formatLKR(r.amount_lkr)}</p>
          {r.refund_amount_lkr > 0 && (
            <p className="text-rose-600">Refund: {formatLKR(r.refund_amount_lkr)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Timestamp',
      sortKey: 'created_at',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Revenue & Settlement Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Verified Payments (Filtered)</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatLKR(summary.verifiedLKR)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Completed: {formatLKR(summary.completedRevenueLKR)} · {formatNumber(summary.totalCount)} tx
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Platform Commission</span>
            <Percent className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            {formatLKR(summary.commissionLKR)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Rider payouts: {formatLKR(summary.riderEarningsLKR)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Refunded Volume</span>
            <ArrowDownLeft className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700">
            {formatLKR(summary.refundedLKR)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Failed attempts: {formatNumber(summary.failedCount)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Authorized Holds & Cash Pending</span>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {formatLKR(summary.authorizedLKR + summary.pendingLKR)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hold {formatLKR(summary.authorizedLKR)} · Cash/Pending {formatLKR(summary.pendingLKR)} · Voided {formatNumber(summary.voidedCount)}
          </p>
        </div>
      </div>

      {/* Revenue by Service Breakdown */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {byService.map((s) => (
          <div
            key={s.serviceType}
            className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-xs shadow-2xs"
          >
            <p className="font-semibold text-slate-900">{s.serviceType}</p>
            <p className="mt-1 text-base font-bold text-slate-900">{formatLKR(s.verifiedLKR)}</p>
            <p className="mt-0.5 text-slate-500">
              Completed {formatLKR(s.completedRevenueLKR)} · {s.txCount} tx · Refunded{' '}
              {formatLKR(s.refundedLKR)}
            </p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        error={error}
        search={search}
        searchPlaceholder="Search booking ID, gateway reference, method, or customer..."
        filterTabs={[
          { value: 'all', label: 'All Payments' },
          { value: 'authorized', label: 'Authorized (Hold)' },
          { value: 'verified', label: 'Captured / Verified' },
          { value: 'pending', label: 'Cash / Pending' },
          { value: 'voided', label: 'Voided Holds' },
          { value: 'refunded', label: 'Refunded' },
          { value: 'failed', label: 'Failed' },
        ]}
        activeFilter={statusFilter}
        showDateFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        extraControls={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="all">All Services</option>
              <option value="Ride Booking">Ride Booking</option>
              <option value="Flexible Ride">Flexible Ride</option>
              <option value="Food Delivery">Food Delivery</option>
              <option value="Parcel Delivery">Parcel Delivery</option>
            </select>
            <a
              href={`/api/rides/export?${new URLSearchParams({
                ...(search.trim() ? { search: search.trim() } : {}),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
              }).toString()}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              {dateFrom && dateTo && dateTo >= dateFrom
                ? `Export Rides ZIP (${
                    Math.round(
                      (Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) /
                        86_400_000
                    ) + 1
                  } daily CSVs)`
                : 'Export Rides CSV'}
            </a>
          </div>
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
        onRowClick={(row) => inspectTx(row.id)}
      />

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Transaction · ${detail.booking_id}` : 'Transaction'}
        subtitle={detail ? `${detail.method} · ${detail.currency}` : ''}
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <StatusBadge value={detail.status} />
                <span className="text-lg font-bold text-slate-900">
                  {formatLKR(detail.amount_lkr)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-slate-400">Customer</dt>
                  <dd className="font-semibold text-slate-900">{detail.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Service</dt>
                  <dd className="font-semibold text-slate-900">{detail.service_type}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Gateway Ref</dt>
                  <dd className="font-mono text-slate-800">{detail.gateway_ref || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Booking Status</dt>
                  <dd>
                    <StatusBadge value={detail.booking_status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Commission / Rider Share</dt>
                  <dd className="font-medium text-slate-800">
                    {formatLKR(detail.platform_commission_lkr)} /{' '}
                    {formatLKR(detail.rider_earnings_lkr)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Refund Amount</dt>
                  <dd className="font-medium text-rose-700">
                    {formatLKR(detail.refund_amount_lkr)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold uppercase tracking-wider text-slate-400">
                Gateway Details
              </p>
              {detail.raw_payload && Object.keys(detail.raw_payload).length > 0 ? (
                <dl className="mt-2.5 space-y-1.5">
                  {Object.entries(detail.raw_payload).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between gap-4 border-b border-slate-100 pb-1 last:border-0 last:pb-0"
                    >
                      <dt className="text-slate-500">{key}</dt>
                      <dd className="text-right font-mono text-slate-900">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-slate-500">No additional gateway metadata recorded.</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
