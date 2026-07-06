import { redirect } from 'next/navigation';

export default async function ClientsAjouterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const qs = welcome === '1' ? '?nouveau=1&welcome=1' : '?nouveau=1';
  redirect(`/clients${qs}`);
}
