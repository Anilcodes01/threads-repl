import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, validSession } from '@/lib/auth';
import Login from '../components/login';
export default async function Page() {
  if (validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/');
  return <Login />;
}
