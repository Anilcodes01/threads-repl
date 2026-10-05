import { sessionCookie } from '@/lib/auth';
import { guardOrigin, error } from '@/lib/threads-http';
export async function POST(request: Request) {
  try {
    guardOrigin(request, true);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie('', new URL(request.url).protocol === 'https:', 0) } });
  } catch (e) { return error(e); }
}
