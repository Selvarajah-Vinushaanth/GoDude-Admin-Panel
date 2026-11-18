export function formatLKR(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return 'LKR 0';
  return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
}

export function formatNumber(val: number | string | null | undefined): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US');
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function parsePageParams(searchParams: URLSearchParams | Record<string, string | string[] | undefined>) {
  const get = (k: string): string => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(k)?.trim() ?? '';
    }
    const v = searchParams[k];
    return Array.isArray(v) ? (v[0]?.trim() ?? '') : (v?.trim() ?? '');
  };

  const page = Math.max(1, parseInt(get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(get('pageSize') || '20', 10) || 20));
  const search = get('search');
  const status = get('status');
  const sort = get('sort');
  const order: 'ASC' | 'DESC' = get('order').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const dateFrom = get('dateFrom');
  const dateTo = get('dateTo');

  return { page, pageSize, offset: (page - 1) * pageSize, search, status, sort, order, dateFrom, dateTo, get };
}
