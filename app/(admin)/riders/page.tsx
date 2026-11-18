import { RidersClient } from '@/components/views/RidersClient';

export const dynamic = 'force-dynamic';

export default async function RidersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  return <RidersClient initialStatus={sp.status ?? 'all'} />;
}
