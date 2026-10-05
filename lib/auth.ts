import 'server-only';
import { createHmac, timingSafeEqual, scrypt, createHash } from 'node:crypto';
export const SESSION_COOKIE = 'threads-session';
export const SESSION_SECONDS = 60 * 60 * 24 * 30;
export const loginEmail = () => process.env.AUTH_EMAIL || 'anilcodes01@gmail.com';
function secret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('Login is not configured. Set AUTH_PASSWORD_HASH and AUTH_SESSION_SECRET on the server.');
  return value;
}
function fingerprint() { return createHash('sha256').update(`${loginEmail()}:${process.env.AUTH_PASSWORD_HASH || ''}`).digest('hex'); }
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url'); }
export function createSession(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS, account: fingerprint() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function validSession(token?: string, now = Date.now()): boolean {
  if (!token || token.length > 2048) return false;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = Buffer.from(sign(payload)), actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(data.exp) && data.exp > Math.floor(now / 1000) && data.exp <= Math.floor(now / 1000) + SESSION_SECONDS && data.account === fingerprint();
  } catch { return false; }
}
export function requestSession(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`));
  return validSession(cookie?.slice(SESSION_COOKIE.length + 1));
}
export async function checkCredentials(email: string, password: string) {
  secret();
  const encoded = process.env.AUTH_PASSWORD_HASH;
  if (!encoded || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded)) throw new Error('Login is not configured. Set AUTH_PASSWORD_HASH and AUTH_SESSION_SECRET on the server.');
  const [, salt, hash] = encoded.split(':');
  const derived = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  const correctPassword = timingSafeEqual(derived, Buffer.from(hash, 'hex'));
  return correctPassword && email.trim().toLowerCase() === loginEmail().toLowerCase();
}
export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
