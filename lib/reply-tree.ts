import type { Thread } from './threads-types';
export type ReplyNode = { reply: Thread; children: ReplyNode[] };
export function replyTree(replies: Thread[]): ReplyNode[] {
  const nodes = new Map(replies.map(reply => [reply.id, { reply, children: [] } as ReplyNode]));
  const roots: ReplyNode[] = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.reply.replied_to?.id || '');
    let cursor = parent;
    const seen = new Set([node.reply.id]);
    let cycle = false;
    while (cursor) {
      if (seen.has(cursor.reply.id)) { cycle = true; break; }
      seen.add(cursor.reply.id);
      cursor = nodes.get(cursor.reply.replied_to?.id || '');
    }
    if (parent && !cycle) parent.children.push(node); else roots.push(node);
  }
  const newest = (a: ReplyNode, b: ReplyNode) => (Date.parse(b.reply.timestamp || '') || 0) - (Date.parse(a.reply.timestamp || '') || 0);
  function sort(items: ReplyNode[]) { items.sort(newest); for (const item of items) sort(item.children); }
  sort(roots);
  return roots;
}
