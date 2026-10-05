import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, validSession } from '@/lib/auth';
import Inbox from './components/inbox';
export default async function Home() {
  if (!validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/login');
  return <Inbox />;
}
