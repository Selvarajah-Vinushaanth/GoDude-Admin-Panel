import { strToU8, zipSync } from 'fflate';

export const MAX_EXPORT_DAYS = 366;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive list of YYYY-MM-DD days between from and to. Throws on invalid input. */
export function enumerateDays(from: string, to: string): string[] {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
    throw new Error('Dates must be in YYYY-MM-DD format');
  }
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error('Invalid date range');
  if (end < start) throw new Error('"To" date must not be before "From" date');
  const count = Math.round((end - start) / 86_400_000) + 1;
  if (count > MAX_EXPORT_DAYS) {
    throw new Error(`Date range too large (max ${MAX_EXPORT_DAYS} days)`);
  }
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  );
}

/** Zip a map of filename -> text content (UTF-8) into a single archive. */
export function zipTextFiles(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8(text);
  return zipSync(entries, { level: 6 });
}
