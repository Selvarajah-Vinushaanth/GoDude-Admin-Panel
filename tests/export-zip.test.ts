import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { enumerateDays, zipTextFiles } from '../lib/export-zip';

test('enumerateDays returns one entry per day, inclusive', () => {
  assert.equal(enumerateDays('2026-11-01', '2026-11-07').length, 7);
  assert.equal(enumerateDays('2026-11-05', '2026-11-07').length, 3);
  assert.deepEqual(enumerateDays('2026-11-28', '2026-11-28'), ['2026-11-28']);
  assert.deepEqual(enumerateDays('2026-12-30', '2027-01-02'), [
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
  ]);
});

test('enumerateDays rejects bad input and oversized ranges', () => {
  assert.throws(() => enumerateDays('2026-11-07', '2026-11-01'));
  assert.throws(() => enumerateDays('nope', '2026-11-01'));
  assert.throws(() => enumerateDays('2020-01-01', '2026-01-01'));
});

test('zipTextFiles produces a readable archive with one file per day', () => {
  const days = enumerateDays('2026-11-01', '2026-11-03');
  const files = Object.fromEntries(days.map((d) => [`rides-${d}.csv`, `﻿header\r\n${d}\r\n`]));
  const out = unzipSync(zipTextFiles(files));
  assert.deepEqual(Object.keys(out).sort(), Object.keys(files).sort());
  const bytes = out['rides-2026-11-02.csv'];
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]); // UTF-8 BOM kept for Excel
  assert.equal(strFromU8(bytes), 'header\r\n2026-11-02\r\n');
});
