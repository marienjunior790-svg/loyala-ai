import { redirect } from 'next/navigation';

/** Legacy URL */
export default function ClientsNewRedirect() {
  redirect('/clients?nouveau=1');
}
