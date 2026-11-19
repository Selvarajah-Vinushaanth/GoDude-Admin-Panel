import { CustomersClient } from '@/components/views/CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search ?? '';
  const role = sp.role ?? 'customer';
  return <CustomersClient key={`${role}:${search}`} initialSearch={search} initialRole={role} />;
}
