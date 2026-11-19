import { BookingsOpsClient } from '@/components/views/BookingsOpsClient';

export const dynamic = 'force-dynamic';

export default async function FoodOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search ?? '';
  const status = sp.status ?? 'all';
  return (
    <BookingsOpsClient
      key={`food:${status}:${search}`}
      mode="food"
      initialSearch={search}
      initialStatus={status}
    />
  );
}
