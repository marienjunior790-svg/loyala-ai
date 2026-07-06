import { redirect } from 'next/navigation';

/** Legacy URL — redirect to /clients/ajouter */
export default function ClientsNewRedirect() {
  redirect('/clients/ajouter');
}
