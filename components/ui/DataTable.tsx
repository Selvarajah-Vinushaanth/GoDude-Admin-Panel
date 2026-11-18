'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortKey?: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

export interface FilterTabOption {
  value: string;
  label: string;
  count?: number;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  loading,
  error,
  search,
  searchPlaceholder = 'Search records...',
  filterTabs,
  activeFilter,
  sort,
  order,
  showDateFilter = false,
  dateFrom = '',
  dateTo = '',
  emptyTitle = 'No matching records found',
  emptyDescription = 'Try adjusting your search query or filters.',
  extraControls,
  onSearchChange,
  onFilterChange,
  onDateChange,
  onSortChange,
  onPageChange,
  onRetry,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error?: string | null;
  search: string;
  searchPlaceholder?: string;
  filterTabs?: FilterTabOption[];
  activeFilter?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
  showDateFilter?: boolean;
  dateFrom?: string;
  dateTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  extraControls?: React.ReactNode;
  onSearchChange: (val: string) => void;
  onFilterChange?: (val: string) => void;
  onDateChange?: (from: string, to: string) => void;
  onSortChange?: (sortKey: string) => void;
  onPageChange: (nextPage: number) => void;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(total, page * pageSize);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showDateFilter && onDateChange && (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateChange(e.target.value, dateTo)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                  aria-label="Date from"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateChange(dateFrom, e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                  aria-label="Date to"
                />
              </>
            )}
            {extraControls}
            {onRetry && (
              <button
                type="button"
                disabled={loading}
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>

        {filterTabs && filterTabs.length > 0 && onFilterChange && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onFilterChange(tab.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                        active ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.sortKey && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-slate-800"
                    >
                      <span>{col.header}</span>
                      {sort === col.sortKey ? (
                        order === 'ASC' ? (
                          <ArrowUp className="h-3 w-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-800">{emptyTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition-colors hover:bg-blue-50/40'
                      : 'hover:bg-slate-50/60'
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 align-middle text-slate-700 ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-xs text-slate-500 sm:flex-row">
        <div>
          Showing <span className="font-semibold text-slate-800">{startRow}</span> to{' '}
          <span className="font-semibold text-slate-800">{endRow}</span> of{' '}
          <span className="font-semibold text-slate-800">{total.toLocaleString()}</span> records
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
