import { BookingsOpsClient } from '@/components/views/BookingsOpsClient';

export const dynamic = 'force-dynamic';

export default async function RidesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  return (
    <BookingsOpsClient
      mode="rides"
      initialSearch={sp.search ?? ''}
      initialStatus={sp.status ?? 'all'}
    />
  );
}
