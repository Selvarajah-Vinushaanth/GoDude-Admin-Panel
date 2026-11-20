'use client';

import React from 'react';

const STYLE_MAP: Record<string, string> = {
  // Approval / Verification / Payment lifecycle
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  captured: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  authorized: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  unverified: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  voided: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  refunded: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  failed: 'bg-rose-50 text-rose-700 ring-rose-600/20',

  // Store & Availability
  OPEN: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  TEMPORARILY_UNAVAILABLE: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  RESERVED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ASSIGNED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ON_RIDE: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ON_FOOD_DELIVERY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ON_PARCEL_DELIVERY: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  ON_TRIP: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  UNAVAILABLE: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  OFFLINE: 'bg-slate-100 text-slate-600 ring-slate-500/20',

  // Booking statuses
  Searching: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Confirmed: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Preparing: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  'Ready for Pickup': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  'Rider Assigned': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Arrived: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  'On the Way': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  'Waiting for Return': 'bg-violet-50 text-violet-700 ring-violet-600/20',
  'Return Scheduled': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  Delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Cancelled: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  'Delivery Failed': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  'Return Initiated': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Returned to Sender': 'bg-slate-100 text-slate-700 ring-slate-500/20',

  // Roles
  customer: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  driver: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  merchant: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  partner: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  admin: 'bg-slate-900 text-white ring-slate-900/20',
};

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const cls =
    STYLE_MAP[value] || 'bg-slate-100 text-slate-700 ring-slate-500/20';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap ${cls}`}
    >
      {label ?? value}
    </span>
  );
}
