import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/auth';
import {
  getSettingsSnapshot,
  updateDeliveryConfigAction,
  updateParcelConfigAction,
  updateRideConfigAction,
  updateVehiclePricingAction,
} from '@/lib/services/admin-comms.service';

const patchSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('vehicle'),
    vehicleId: z.string().min(1),
    baseFareLKR: z.number().int().min(50).max(5000).optional(),
    perKmRateLKR: z.number().int().min(20).max(2000).optional(),
    perMinWaitLKR: z.number().int().min(0).max(500).optional(),
    parcelHandlingFeeLKR: z.number().int().min(0).max(3000).optional(),
    surgeMultiplier: z.number().min(1).max(3).optional(),
  }),
  z.object({
    section: z.literal('delivery'),
    baseFeeLKR: z.number().int().min(0).max(1000).optional(),
    perKmFeeLKR: z.number().int().min(0).max(500).optional(),
    minFeeLKR: z.number().int().min(0).max(1000).optional(),
    maxFeeLKR: z.number().int().min(50).max(5000).optional(),
    serviceFeeLKR: z.number().int().min(0).max(500).optional(),
    savingsPct: z.number().min(0).max(50).optional(),
  }),
  z.object({
    section: z.literal('parcel'),
    platformCommissionPct: z.number().min(0).max(45).optional(),
    fragileSurchargeLKR: z.number().int().min(0).max(5000).optional(),
    weightSurchargePerKgLKR: z.number().int().min(0).max(2000).optional(),
    minDeliveryFeeLKR: z.number().int().min(50).max(5000).optional(),
    requirePickupOtp: z.boolean().optional(),
    requireDeliveryOtp: z.boolean().optional(),
    savingsPct: z.number().min(0).max(50).optional(),
  }),
  z.object({
    section: z.literal('ride'),
    platformCommissionPct: z.number().min(0).max(45).optional(),
    savingsPct: z.number().min(0).max(50).optional(),
  }),
]);

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const data = await getSettingsSnapshot();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid settings update' },
        { status: 400 }
      );
    }

    if (parsed.data.section === 'vehicle') {
      const { vehicleId, ...rest } = parsed.data;
      await updateVehiclePricingAction(auth.session, vehicleId, rest);
    } else if (parsed.data.section === 'delivery') {
      await updateDeliveryConfigAction(auth.session, parsed.data);
    } else if (parsed.data.section === 'ride') {
      await updateRideConfigAction(auth.session, parsed.data);
    } else {
      await updateParcelConfigAction(auth.session, parsed.data);
    }

    const refreshed = await getSettingsSnapshot();
    return NextResponse.json({ ok: true, ...refreshed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save settings' },
      { status: 400 }
    );
  }
}
