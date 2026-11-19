'use client';

import React, { useState } from 'react';
import { formatLKR } from '@/lib/format';

export interface DailyTrendPoint {
  day: string;
  label: string;
  rides: number;
  food: number;
  parcel: number;
  revenueLKR: number;
}

export function ServiceTrendsChart({ data }: { data: DailyTrendPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(
    data.length > 0 ? data.length - 1 : null
  );

  const maxBookings = Math.max(
    1,
    ...data.map((d) => d.rides + d.food + d.parcel)
  );
  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            14-Day Platform Volume & Revenue
          </h3>
          <p className="text-xs text-slate-500">
            Daily activity across Ride Booking, Food Delivery, and Parcel Logistics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Rides
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Food
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Parcels
          </span>
        </div>
      </div>

      {activePoint && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-xs">
          <div className="font-semibold text-slate-800">{activePoint.label}</div>
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>
              Rides: <strong className="text-blue-700">{activePoint.rides}</strong>
            </span>
            <span>
              Food: <strong className="text-emerald-700">{activePoint.food}</strong>
            </span>
            <span>
              Parcels: <strong className="text-amber-700">{activePoint.parcel}</strong>
            </span>
            <span>
              Completed Revenue:{' '}
              <strong className="text-slate-900">{formatLKR(activePoint.revenueLKR)}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="mt-5 flex h-44 items-end gap-1.5 border-b border-slate-100 pb-2">
        {data.map((point, idx) => {
          const total = point.rides + point.food + point.parcel;
          const totalPct = (total / maxBookings) * 100;
          const ridePct = total > 0 ? (point.rides / total) * totalPct : 0;
          const foodPct = total > 0 ? (point.food / total) * totalPct : 0;
          const parcelPct = total > 0 ? (point.parcel / total) * totalPct : 0;
          const isActive = hoveredIdx === idx;

          return (
            <button
              key={point.day}
              type="button"
              onMouseEnter={() => setHoveredIdx(idx)}
              onFocus={() => setHoveredIdx(idx)}
              onClick={() => setHoveredIdx(idx)}
              className={`group flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-lg px-0.5 pt-2 transition ${
                isActive ? 'bg-blue-50/60' : 'hover:bg-slate-50'
              }`}
              title={`${point.label}: ${total} bookings · ${formatLKR(point.revenueLKR)}`}
            >
              <div className="flex w-full max-w-[26px] flex-1 flex-col justify-end overflow-hidden rounded-t-md">
                {total === 0 ? (
                  <div className="h-1 w-full rounded bg-slate-100" />
                ) : (
                  <>
                    <div
                      style={{ height: `${parcelPct}%` }}
                      className="w-full bg-amber-500 transition-all"
                    />
                    <div
                      style={{ height: `${foodPct}%` }}
                      className="w-full bg-emerald-500 transition-all"
                    />
                    <div
                      style={{ height: `${ridePct}%` }}
                      className="w-full bg-blue-600 transition-all"
                    />
                  </>
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-slate-700">
                {point.label.split(' ')[1] || point.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
