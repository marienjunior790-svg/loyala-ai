import { redirect } from 'next/navigation';

/** Root redirect — routing logic expanded Sprint 1 (auth) */
export default function RootPage() {
  redirect('/login');
}
