import { graph, ThreadsError, verifyPost } from '@/lib/threads';
import { guard, id, error } from '@/lib/threads-http';
import { generateReply } from '@/lib/gemini';
import type { Thread } from '@/lib/threads-types';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    guard(request, true);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ThreadsError('JSON request required.', 400);
    const raw = await request.text();
    if (raw.length > 12000) throw new ThreadsError('Invalid generation request.', 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ThreadsError('Invalid generation request.', 400); }
    if (!body || typeof body !== 'object') throw new ThreadsError('Invalid generation request.', 400);
    const postId = id(body.postId), replyId = id(body.replyId);
    if (body.instructions !== undefined && typeof body.instructions !== 'string') throw new ThreadsError('Instructions must be text.', 400);
    const instructions = (body.instructions || '').trim();
    if (Array.from(instructions).length > 1000) throw new ThreadsError('Keep custom instructions under 1,000 characters.', 400);
    await verifyPost(postId);
    const comment = await graph<Thread>(replyId, { fields: 'id,text,root_post,replied_to' });
    if (comment.root_post?.id !== postId) throw new ThreadsError('This comment does not belong to the selected post.', 403);
    if (!comment.text?.trim()) throw new ThreadsError('This comment has no text to generate a reply from.', 400);
    const post = await graph<Thread>(postId, { fields: 'id,text' });
    let parent: string | undefined;
    if (comment.replied_to?.id && comment.replied_to.id !== postId) {
      const parentReply = await graph<Thread>(id(comment.replied_to.id), { fields: 'id,text,root_post' });
      if (parentReply.root_post?.id === postId) parent = parentReply.text;
    }
    const text = await generateReply({ post: (post.text || '').slice(0, 12000), comment: comment.text.slice(0, 12000), parent: parent?.slice(0, 12000) }, instructions);
    return Response.json({ text }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return error(e); }
}
