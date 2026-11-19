import { RidersClient } from '@/components/views/RidersClient';

export const dynamic = 'force-dynamic';

export default async function RidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? 'all';
  const search = sp.search ?? '';
  return <RidersClient key={`${status}:${search}`} initialStatus={status} initialSearch={search} />;
}
