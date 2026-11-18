import { RestaurantsClient } from '@/components/views/RestaurantsClient';

export const dynamic = 'force-dynamic';

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; inspect?: string }>;
}) {
  const sp = await searchParams;
  return (
    <RestaurantsClient
      initialStatus={sp.status ?? 'all'}
      initialInspect={sp.inspect ?? ''}
    />
  );
}
