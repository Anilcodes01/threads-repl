import { requestSession } from './auth';
import { ThreadsError } from './threads';
export function guardOrigin(request: Request, write = false) {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const origins = [process.env.AUTH_APP_ORIGIN, ...[process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(host => `https://${host}`)].filter(Boolean);
  if ((host && host !== url.host) || (!local && (url.protocol !== 'https:' || !origins.includes(url.origin)))) throw new ThreadsError('This deployment domain is not allowed. Set AUTH_APP_ORIGIN to your site URL.', 403);
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || (write && !origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ThreadsError('Request origin is not allowed.', 403);
}
export function guard(request: Request, write = false) {
  guardOrigin(request, write);
  if (!requestSession(request)) throw new ThreadsError('Sign in to use your Threads inbox.', 401);
}
export function id(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) throw new ThreadsError('Invalid Threads post ID.', 400);
  return value;
}
export function error(e: unknown) {
  return Response.json({ ...(e instanceof ThreadsError && e.status === 401 && e.message.startsWith('Sign in') ? { authRequired: true } : {}), error: e instanceof ThreadsError ? e.message : 'Unable to complete this request. Please try again.' }, { status: e instanceof ThreadsError ? e.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
