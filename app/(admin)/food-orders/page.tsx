import { BookingsOpsClient } from '@/components/views/BookingsOpsClient';

export const dynamic = 'force-dynamic';

export default async function FoodOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  return (
    <BookingsOpsClient
      mode="food"
      initialSearch={sp.search ?? ''}
      initialStatus={sp.status ?? 'all'}
    />
  );
}
