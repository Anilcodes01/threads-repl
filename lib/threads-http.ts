import { ThreadsError } from './threads';
export function guard(request: Request, write = false) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || '';
  const allowed = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  if (!allowed.test(host) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new ThreadsError('This personal inbox is available on localhost only.', 403);
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || (write && !origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ThreadsError('Request origin is not allowed.', 403);
}
export function id(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) throw new ThreadsError('Invalid Threads post ID.', 400);
  return value;
}
export function error(e: unknown) {
  return Response.json({ error: e instanceof ThreadsError ? e.message : 'Unable to complete this request. Please try again.' }, { status: e instanceof ThreadsError ? e.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
