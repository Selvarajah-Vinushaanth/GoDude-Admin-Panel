'use client';

import React, { useEffect, useState } from 'react';
import { Save, Car, Truck, Package, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { formatDateTime, formatLKR } from '@/lib/format';

interface VehicleRule {
  id: string;
  name: string;
  base_fare_lkr: number;
  per_km_rate_lkr: number;
  per_min_wait_lkr: number;
  parcel_handling_fee_lkr: number;
  surge_multiplier: number;
}

interface DeliveryCfg {
  base_fee_lkr: number;
  per_km_fee_lkr: number;
  min_fee_lkr: number;
  max_fee_lkr: number;
  service_fee_lkr: number;
  savings_pct?: number;
}

interface ParcelCfg {
  platform_commission_pct: number;
  fragile_surcharge_lkr: number;
  weight_surcharge_per_kg_lkr: number;
  min_delivery_fee_lkr: number;
  require_pickup_otp: boolean;
  require_delivery_otp: boolean;
  savings_pct?: number;
}

interface RideCfg {
  platform_commission_pct: number;
  savings_pct: number;
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  admin_name: string;
  created_at: string;
}

export function SettingsClient() {
  const { pushToast } = useToast();
  const [vehicles, setVehicles] = useState<VehicleRule[]>([]);
  const [delivery, setDelivery] = useState<DeliveryCfg | null>(null);
  const [parcel, setParcel] = useState<ParcelCfg | null>(null);
  const [ride, setRide] = useState<RideCfg | null>(null);
  const [zones, setZones] = useState<
    Array<{ id: string; name: string; city: string; radius_km: number; base_fee_lkr: number | null; is_active: boolean }>
  >([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/settings', { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load settings');
        return json;
      })
      .then((json) => {
        if (!active) return;
        setVehicles(json.vehicles || []);
        setDelivery(json.deliveryConfig || null);
        setParcel(json.parcelConfig || null);
        setRide(json.rideConfig || null);
        setZones(json.deliveryZones || []);
        setAuditLogs(json.auditLogs || []);
      })
      .catch((err) => {
        if (active) {
          pushToast('Error', err instanceof Error ? err.message : 'Load failed', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pushToast]);

  async function savePatch(key: string, payload: Record<string, unknown>) {
    setSavingKey(key);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setVehicles(json.vehicles || vehicles);
      setDelivery(json.deliveryConfig || delivery);
      setParcel(json.parcelConfig || parcel);
      setRide(json.rideConfig || ride);
      setAuditLogs(json.auditLogs || auditLogs);
      pushToast('Configuration Saved', 'Live platform parameters updated.', 'success');
    } catch (err) {
      pushToast('Save Failed', err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vehicle Tiers Pricing */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Vehicle Pricing Tiers
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{v.name}</p>
                <span className="font-mono uppercase text-slate-400">{v.id}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-slate-500">Base Fare (LKR)</span>
                  <input
                    type="number"
                    value={v.base_fare_lkr}
                    onChange={(e) =>
                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id ? { ...x, base_fare_lkr: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Per Km Rate (LKR)</span>
                  <input
                    type="number"
                    value={v.per_km_rate_lkr}
                    onChange={(e) =>
                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id ? { ...x, per_km_rate_lkr: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Parcel Handling (LKR)</span>
                  <input
                    type="number"
                    value={v.parcel_handling_fee_lkr}
                    onChange={(e) =>
                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id
                            ? { ...x, parcel_handling_fee_lkr: Number(e.target.value) }
                            : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="text-slate-500">Surge Multiplier</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    max="3"
                    value={v.surge_multiplier}
                    onChange={(e) =>
                      setVehicles((prev) =>
                        prev.map((x) =>
                          x.id === v.id ? { ...x, surge_multiplier: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={savingKey === v.id}
                onClick={() =>
                  savePatch(v.id, {
                    section: 'vehicle',
                    vehicleId: v.id,
                    baseFareLKR: v.base_fare_lkr,
                    perKmRateLKR: v.per_km_rate_lkr,
                    parcelHandlingFeeLKR: v.parcel_handling_fee_lkr,
                    surgeMultiplier: Number(v.surge_multiplier),
                  })
                }
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingKey === v.id ? 'Saving...' : `Save ${v.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Ride Commission & Customer Savings Configuration */}
      {ride && (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-blue-600" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ride Commission &amp; Savings Rules
                </h2>
                <p className="text-[11px] text-slate-500">
                  Applies to Point-to-Point, Return Trip, and Flexible Metered Ride bookings.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={savingKey === 'ride'}
              onClick={() =>
                savePatch('ride', {
                  section: 'ride',
                  platformCommissionPct: Number(ride.platform_commission_pct),
                  savingsPct: Number(ride.savings_pct),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === 'ride' ? 'Saving...' : 'Save Ride Commission & Savings'}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-slate-500">
                Ride Platform Commission (% of Trip Fee)
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="45"
                value={Number(ride.platform_commission_pct ?? 15)}
                onChange={(e) =>
                  setRide({ ...ride, platform_commission_pct: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
              />
            </label>
            <label className="block">
              <span className="text-slate-500">
                Ride Customer Savings Reward (% of Trip Fare — Wallet Credit)
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={Number(ride.savings_pct ?? 10)}
                onChange={(e) => setRide({ ...ride, savings_pct: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
              />
            </label>
          </div>
        </section>
      )}

      {/* Food Delivery & Parcel Configuration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {delivery && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Food Delivery Configuration
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-500">Base Fee (LKR)</span>
                <input
                  type="number"
                  value={delivery.base_fee_lkr}
                  onChange={(e) =>
                    setDelivery({ ...delivery, base_fee_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Per Km Fee (LKR)</span>
                <input
                  type="number"
                  value={delivery.per_km_fee_lkr}
                  onChange={(e) =>
                    setDelivery({ ...delivery, per_km_fee_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Min / Max Fee (LKR)</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    value={delivery.min_fee_lkr}
                    onChange={(e) =>
                      setDelivery({ ...delivery, min_fee_lkr: Number(e.target.value) })
                    }
                    className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-semibold"
                  />
                  <input
                    type="number"
                    value={delivery.max_fee_lkr}
                    onChange={(e) =>
                      setDelivery({ ...delivery, max_fee_lkr: Number(e.target.value) })
                    }
                    className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-semibold"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-slate-500">Platform Service Fee (LKR)</span>
                <input
                  type="number"
                  value={delivery.service_fee_lkr}
                  onChange={(e) =>
                    setDelivery({ ...delivery, service_fee_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-slate-500">
                  Customer Delivery Savings Reward (% of Delivery Fee — Wallet Credit)
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={Number(delivery.savings_pct ?? 10)}
                  onChange={(e) =>
                    setDelivery({ ...delivery, savings_pct: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={savingKey === 'delivery'}
              onClick={() =>
                savePatch('delivery', {
                  section: 'delivery',
                  baseFeeLKR: delivery.base_fee_lkr,
                  perKmFeeLKR: delivery.per_km_fee_lkr,
                  minFeeLKR: delivery.min_fee_lkr,
                  maxFeeLKR: delivery.max_fee_lkr,
                  serviceFeeLKR: delivery.service_fee_lkr,
                  savingsPct: Number(delivery.savings_pct ?? 10),
                })
              }
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === 'delivery' ? 'Saving...' : 'Save Delivery Rules'}
            </button>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="font-semibold text-slate-700">Active Sri Lanka Delivery Zones ({zones.length})</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {zones.map((z) => (
                  <span
                    key={z.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
                  >
                    {z.name} ({z.radius_km} km · {formatLKR(z.base_fee_lkr ?? delivery.base_fee_lkr)})
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {parcel && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Parcel Logistics & OTP Rules
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-500">Commission (%)</span>
                <input
                  type="number"
                  step="0.5"
                  value={parcel.platform_commission_pct}
                  onChange={(e) =>
                    setParcel({ ...parcel, platform_commission_pct: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Fragile Surcharge (LKR)</span>
                <input
                  type="number"
                  value={parcel.fragile_surcharge_lkr}
                  onChange={(e) =>
                    setParcel({ ...parcel, fragile_surcharge_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Weight Surcharge / kg</span>
                <input
                  type="number"
                  value={parcel.weight_surcharge_per_kg_lkr}
                  onChange={(e) =>
                    setParcel({ ...parcel, weight_surcharge_per_kg_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="block">
                <span className="text-slate-500">Min Delivery Fee (LKR)</span>
                <input
                  type="number"
                  value={parcel.min_delivery_fee_lkr}
                  onChange={(e) =>
                    setParcel({ ...parcel, min_delivery_fee_lkr: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-slate-500">Parcel Customer Savings (% of Fare)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  value={Number(parcel.savings_pct ?? 10)}
                  onChange={(e) =>
                    setParcel({ ...parcel, savings_pct: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={parcel.require_pickup_otp}
                  onChange={(e) => setParcel({ ...parcel, require_pickup_otp: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                Require Pickup Handover OTP
              </label>
              <label className="inline-flex items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={parcel.require_delivery_otp}
                  onChange={(e) => setParcel({ ...parcel, require_delivery_otp: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                Require Recipient Delivery OTP
              </label>
            </div>
            <button
              type="button"
              disabled={savingKey === 'parcel'}
              onClick={() =>
                savePatch('parcel', {
                  section: 'parcel',
                  platformCommissionPct: Number(parcel.platform_commission_pct),
                  fragileSurchargeLKR: parcel.fragile_surcharge_lkr,
                  weightSurchargePerKgLKR: parcel.weight_surcharge_per_kg_lkr,
                  minDeliveryFeeLKR: parcel.min_delivery_fee_lkr,
                  requirePickupOtp: parcel.require_pickup_otp,
                  requireDeliveryOtp: parcel.require_delivery_otp,
                  savingsPct: Number(parcel.savings_pct ?? 10),
                })
              }
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === 'parcel' ? 'Saving...' : 'Save Parcel Rules'}
            </button>
          </section>
        )}
      </div>

      {/* Administrative Audit Trail */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Administrative Audit Trail
          </h2>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 px-3">Target</th>
                <th className="py-2 px-3">Reason / Notes</th>
                <th className="py-2 px-3">Admin</th>
                <th className="py-2 pl-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No audit log entries recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.target_type}: <span className="font-mono">{log.target_id}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{log.reason || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{log.admin_name}</td>
                    <td className="py-2.5 pl-3 text-right text-slate-500">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
