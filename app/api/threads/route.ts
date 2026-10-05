import { guard, id, error } from '@/lib/threads-http';
import { graph, page, profile, ThreadsError, verifyPost } from '@/lib/threads';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    guard(request);
    const params = new URL(request.url).searchParams;
    const after = params.get('after') || undefined;
    if (after && after.length > 4096) throw new ThreadsError('Invalid pagination cursor.', 400);
    const postId = params.get('postId');
    const result = postId ? (await verifyPost(id(postId)), await page(`${postId}/conversation`, after, true)) : { ...await page('me/threads', after), profile: await profile() };
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try {
    guard(request, true);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ThreadsError('JSON request required.', 400);
    const raw = await request.text();
    if (raw.length > 10000) throw new ThreadsError('Reply is too long.', 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ThreadsError('Invalid reply request.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ThreadsError('Invalid reply request.', 400);
    const postId = id(body.postId), replyId = id(body.replyId);
    if (typeof body.text !== 'string' || !body.text.trim() || Array.from(body.text.trim()).length > 500) throw new ThreadsError('Replies must contain between 1 and 500 characters.', 400);
    await verifyPost(postId);
    if (replyId !== postId) {
      const reply = await graph<{ root_post?: { id: string } }>(replyId, { fields: 'id,root_post' });
      if (reply.root_post?.id !== postId) throw new ThreadsError('This reply does not belong to the selected post.', 403);
    }
    const container = await graph<{ id: string }>('me/threads', { media_type: 'TEXT', text: body.text.trim(), reply_to_id: replyId }, 'POST');
    let published;
    try { published = await graph<{ id: string }>('me/threads_publish', { creation_id: container.id }, 'POST'); }
    catch { throw new ThreadsError('Publish could not be confirmed. Refresh the conversation or check Threads before sending again to avoid a duplicate.'); }
    return Response.json(published, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return error(e); }
}
