'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (title: string, message?: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (title: string, message?: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, title, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-50 flex w-full max-w-sm flex-col gap-2.5">
        {toasts.map((t) => {
          const styles =
            t.variant === 'success'
              ? 'border-emerald-200 bg-white/95 text-slate-900'
              : t.variant === 'error'
                ? 'border-rose-200 bg-white/95 text-slate-900'
                : 'border-blue-200 bg-white/95 text-slate-900';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg shadow-slate-900/5 backdrop-blur-md transition-all ${styles}`}
            >
              {t.variant === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : t.variant === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-slate-600">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { pushToast: () => {} };
  }
  return ctx;
}
