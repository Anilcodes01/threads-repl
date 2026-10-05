import 'server-only';
import type { Thread, ThreadPage, Profile } from './threads-types';
const base = 'https://graph.threads.net/v1.0/';
const fields = 'id,text,username,timestamp,permalink,media_type,media_url,thumbnail_url,has_replies,is_reply,children{id,media_type,media_url,thumbnail_url}';
export class ThreadsError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export async function graph<T>(path: string, params: Record<string, string> = {}, method = 'GET'): Promise<T> {
  const token = process.env.THREADS_TOKEN || process.env.threads_token;
  if (!token) throw new ThreadsError('Add THREADS_TOKEN to .env and restart the app.', 503);
  const url = new URL(path, base);
  const body = new URLSearchParams(params);
  if (method === 'GET') url.search = body.toString();
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: method === 'POST' ? body : undefined, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  } catch { throw new ThreadsError('Threads could not be reached. Try again shortly.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.error) {
    const code = result?.error?.code;
    if (code === 190) throw new ThreadsError('Your Threads token has expired or is invalid. Update THREADS_TOKEN in .env and restart the app.', 401);
    if (code === 10 || code === 200) throw new ThreadsError('Your token is missing permission. Enable threads_basic, threads_read_replies, threads_manage_replies and threads_content_publish, then generate a new token.', 403);
    if (response.status === 429 || [4, 32, 613].includes(code)) throw new ThreadsError('Threads API rate limit reached. Wait a few minutes before refreshing.', 429);
    // Do not forward upstream messages: they can include credential or request details.
    throw new ThreadsError(`Threads rejected this request${code ? ` (code ${code})` : ''}. Check the token permissions and try again.`);
  }
  if (!result) throw new ThreadsError('Threads returned an unreadable response.');
  return result as T;
}
export const profile = () => graph<Profile>('me', { fields: 'id,username,name,threads_profile_picture_url' });
export async function page(path: string, after?: string, conversation = false): Promise<ThreadPage> {
  const result = await graph<{ data: Thread[]; paging?: { next?: string; cursors?: { after?: string } } }>(path, {
    fields: conversation ? `${fields},root_post,replied_to,is_reply_owned_by_me` : fields,
    limit: conversation ? '50' : '10', ...(after ? { after } : {}), ...(conversation ? { reverse: 'true' } : {}),
  });
  return { data: result.data, after: result.paging?.next ? result.paging.cursors?.after || null : null };
}
export async function verifyPost(id: string) {
  const [me, post] = await Promise.all([profile(), graph<Thread & { owner?: { id: string } }>(id, { fields: 'id,owner,is_reply' })]);
  if (post.owner?.id !== me.id || post.is_reply) throw new ThreadsError('Select one of your own root posts.', 403);
}
