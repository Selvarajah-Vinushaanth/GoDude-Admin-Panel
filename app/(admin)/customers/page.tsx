import { CustomersClient } from '@/components/views/CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const sp = await searchParams;
  return <CustomersClient initialSearch={sp.search ?? ''} />;
}
