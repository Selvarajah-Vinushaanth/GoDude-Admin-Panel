'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send, Bell, Search } from 'lucide-react';
import { DataTable, TableColumn } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateTime } from '@/lib/format';

interface NotificationRow {
  id: string;
  user_id: string;
  booking_id: string | null;
  role_target: string;
  event_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  recipient_name: string;
  recipient_phone: string | null;
}

interface RecipientOption {
  user_id: string;
  full_name: string;
  phone: string | null;
  restaurant_id?: string;
  label: string;
  city: string;
}

export function NotificationsClient() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    unread: 0,
    merchant: 0,
    driver: 0,
    customer: 0,
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Instruction Composer
  const [composeRole, setComposeRole] = useState<'merchant' | 'driver' | 'customer'>('merchant');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [eventType, setEventType] = useState('restaurant_onboarding_instruction');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        roleTarget: roleFilter,
      });
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/notifications?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load notifications');
      setRows(json.items || []);
      setTotal(json.total || 0);
      if (json.counts) setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchList, 180);
    return () => clearTimeout(t);
  }, [fetchList]);

  useEffect(() => {
    let active = true;
    async function loadRecipients() {
      const qs = new URLSearchParams({
        mode: 'recipients',
        roleTarget: composeRole,
        search: recipientSearch,
      });
      const res = await fetch(`/api/notifications?${qs}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (active && res.ok) {
        const list = (json.recipients || []) as RecipientOption[];
        setRecipients(list);
        if (list.length > 0 && !list.some((x) => x.user_id === selectedUserId)) {
          setSelectedUserId(list[0].user_id);
          setSelectedRestaurantId(list[0].restaurant_id || '');
        }
      }
    }
    const t = setTimeout(loadRecipients, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [composeRole, recipientSearch, selectedUserId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      pushToast('Missing Recipient', 'Please select a recipient first.', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          roleTarget: composeRole,
          eventType,
          title,
          body,
          restaurantId: selectedRestaurantId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to dispatch notification');
      pushToast('Instruction Dispatched', 'Delivered to recipient via GoDude notifications.', 'success');
      setTitle('');
      setBody('');
      await fetchList();
    } catch (err) {
      pushToast('Send Failed', err instanceof Error ? err.message : 'Error sending notice', 'error');
    } finally {
      setSending(false);
    }
  }

  const columns: TableColumn<NotificationRow>[] = [
    {
      key: 'recipient',
      header: 'Recipient',
      render: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-900">{r.recipient_name}</p>
          <p className="text-slate-500">{r.recipient_phone || r.user_id.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'role_target',
      header: 'Audience',
      render: (r) => <StatusBadge value={r.role_target} />,
    },
    {
      key: 'content',
      header: 'Notification & Instruction',
      render: (r) => (
        <div className="max-w-md text-xs">
          <p className="font-semibold text-slate-900">{r.title}</p>
          <p className="mt-0.5 line-clamp-2 text-slate-600">{r.body}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            {r.event_type}
            {r.booking_id ? ` · ${r.booking_id}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'is_read',
      header: 'Read',
      render: (r) => (
        <StatusBadge value={r.is_read ? 'approved' : 'pending'} label={r.is_read ? 'Read' : 'Unread'} />
      ),
    },
    {
      key: 'created_at',
      header: 'Sent At',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Left: Dispatch Administrative Instruction */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm xl:col-span-1">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Send Administrative Instruction
            </h2>
            <p className="text-xs text-slate-500">
              Writes directly to GoDude notifications infrastructure
            </p>
          </div>
        </div>

        <form onSubmit={handleSend} className="mt-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Target Audience</label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(
                [
                  ['merchant', 'Restaurant'],
                  ['driver', 'Rider'],
                  ['customer', 'Customer'],
                ] as const
              ).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setComposeRole(role);
                    setEventType(
                      role === 'merchant'
                        ? 'restaurant_onboarding_instruction'
                        : role === 'driver'
                          ? 'driver_verification_feedback'
                          : 'customer_service_notice'
                    );
                  }}
                  className={`rounded-xl py-2 font-semibold transition ${
                    composeRole === role
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Find Recipient</label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                placeholder="Filter restaurant, rider, or customer..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => {
                const uid = e.target.value;
                setSelectedUserId(uid);
                const found = recipients.find((r) => r.user_id === uid);
                setSelectedRestaurantId(found?.restaurant_id || '');
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
            >
              {recipients.length === 0 ? (
                <option value="">No recipients matched</option>
              ) : (
                recipients.map((r) => (
                  <option key={`${r.user_id}-${r.label}`} value={r.user_id}>
                    {r.label} ({r.full_name} · {r.city || r.phone || 'N/A'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Instruction Template</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="restaurant_onboarding_instruction">
                Restaurant Approval Instructions
              </option>
              <option value="restaurant_additional_info_requested">
                Restaurant Additional Info Request
              </option>
              <option value="driver_verification_feedback">Rider Verification Feedback</option>
              <option value="registration_compliance_notice">Registration Compliance Notice</option>
              <option value="admin_operational_alert">Operational Notice</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Notification Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Upload Business Registration Certificate"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Message / Instructions</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write clear instructions for the partner or customer..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !selectedUserId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sending ? 'Dispatching...' : 'Send Notification'}</span>
          </button>
        </form>
      </div>

      {/* Right: Persistent Notifications History */}
      <div className="xl:col-span-2">
        <DataTable
          columns={columns}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          search={search}
          searchPlaceholder="Search notifications, titles, event types, or recipients..."
          filterTabs={[
            { value: 'all', label: 'All Logs', count: counts.total },
            { value: 'merchant', label: 'Restaurants', count: counts.merchant },
            { value: 'driver', label: 'Riders', count: counts.driver },
            { value: 'customer', label: 'Customers', count: counts.customer },
          ]}
          activeFilter={roleFilter}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onFilterChange={(val) => {
            setRoleFilter(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onRetry={fetchList}
        />
      </div>
    </div>
  );
}
