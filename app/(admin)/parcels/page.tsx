import { BookingsOpsClient } from '@/components/views/BookingsOpsClient';

export const dynamic = 'force-dynamic';

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  return (
    <BookingsOpsClient
      mode="parcels"
      initialSearch={sp.search ?? ''}
      initialStatus={sp.status ?? 'all'}
    />
  );
}
