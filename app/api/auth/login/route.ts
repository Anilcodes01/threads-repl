import { checkCredentials, createSession, sessionCookie } from '@/lib/auth';
import { guardOrigin, error } from '@/lib/threads-http';
import { ThreadsError } from '@/lib/threads';
export const runtime = 'nodejs';
// Per-instance backstop; use the hosting firewall for distributed rate limiting.
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  try {
    guardOrigin(request, true);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ThreadsError('JSON request required.', 400);
    const now = Date.now();
    const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
    for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
    const attempt = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) return Response.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '900' } });
    if (attempts.size > 2000 && !attempts.has(ip)) throw new ThreadsError('Login is busy. Try again shortly.', 429);
    attempt.count++; attempts.set(ip, attempt);
    const raw = await request.text();
    if (raw.length > 4096) throw new ThreadsError('Invalid login request.', 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ThreadsError('Invalid login request.', 400); }
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length > 254 || body.password.length > 1024) throw new ThreadsError('Enter your email and password.', 400);
    let valid;
    try { valid = await checkCredentials(body.email, body.password); }
    catch { throw new ThreadsError('Login is not configured. Set AUTH_PASSWORD_HASH and AUTH_SESSION_SECRET in the deployment environment.', 503); }
    if (!valid) throw new ThreadsError('Email or password is incorrect.', 401);
    attempts.delete(ip);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie(createSession(), new URL(request.url).protocol === 'https:') } });
  } catch (e) { return error(e); }
}
