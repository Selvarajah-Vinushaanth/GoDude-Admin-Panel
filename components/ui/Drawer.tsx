'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-2xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <aside
        className={`relative z-10 flex h-full w-full ${widthClass} flex-col border-l border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

export function ActionConfirmDialog(props: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: 'primary' | 'danger' | 'success' | 'warning';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
}) {
  if (!props.open) return null;
  return <ActionConfirmDialogContent {...props} />;
}

function ActionConfirmDialogContent({
  title,
  description,
  confirmLabel,
  confirmTone = 'primary',
  requireReason = false,
  reasonLabel = 'Reason / Instructions',
  reasonPlaceholder = 'Enter details or feedback for audit trail & notifications...',
  defaultReason = '',
  loading = false,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: 'primary' | 'danger' | 'success' | 'warning';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState(defaultReason);

  const btnCls =
    confirmTone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : confirmTone === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
        : confirmTone === 'warning'
          ? 'bg-amber-600 hover:bg-amber-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-600">{description}</p>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-700">
            {reasonLabel} {requireReason ? <span className="text-rose-600">*</span> : '(Optional)'}
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || (requireReason && reason.trim().length < 3)}
            onClick={() => onConfirm(reason.trim())}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${btnCls}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
