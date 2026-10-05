/* Remote media URLs are supplied by Threads and can expire; display them without image optimization. */
/* eslint-disable @next/next/no-img-element */
"use client";
import { replyTree, type ReplyNode } from '@/lib/reply-tree';
import EmojiControl from "./emoji-control";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Thread, ThreadPage, Profile } from "@/lib/threads-types";
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}
function unique(items: Thread[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
function date(value?: string) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}
function Media({ item }: { item: Thread }) {
  const media = item.children?.data || [item];
  return (
    <div className="media">
      {media.map(
        (m) =>
          m.media_url &&
          (m.media_type === "VIDEO" ? (
            <video key={m.id} src={m.media_url} controls preload="none" />
          ) : m.media_type === "IMAGE" ? (
            <img
              key={m.id}
              src={m.media_url}
              alt="Threads post attachment"
              loading="lazy"
            />
          ) : null),
      )}
    </div>
  );
}
export default function Inbox() {
  const [posts, setPosts] = useState<Thread[]>([]),
    [me, setMe] = useState<Profile>();
  const [postCursor, setPostCursor] = useState<string | null>(null),
    [postBusy, setPostBusy] = useState(true),
    [postError, setPostError] = useState("");
  const [selected, setSelected] = useState<Thread | null>(null),
    [search, setSearch] = useState("");
  const [replies, setReplies] = useState<Thread[]>([]),
    [replyCursor, setReplyCursor] = useState<string | null>(null),
    [replyBusy, setReplyBusy] = useState(false),
    [replyError, setReplyError] = useState("");
  const [target, setTarget] = useState<Thread | null>(null),
    [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [sendError, setSendError] = useState(""),
    [notice, setNotice] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const generationVersion = useRef(0);
  const busy = sending || generating !== null;
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("threads-theme");
      // Remove browser data left by the retired notification feature.
      const retiredKeys = Object.keys(localStorage).filter(key => key.startsWith("threads-read:") || key.startsWith("threads-notifications:"));
      for (const key of retiredKeys) localStorage.removeItem(key);
    } catch { /* Storage can be unavailable. */ }
    const next = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    // Synchronize the saved browser preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(next);
  }, []);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem("threads-theme", next); } catch { /* Keep the in-memory preference. */ }
  }
  const requestVersion = useRef(0);
  const conversationScroll = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const loadPosts = useCallback(async (after?: string) => {
    setPostBusy(true);
    setPostError("");
    try {
      const result = await api<ThreadPage & { profile: Profile }>(
        `/api/threads${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      const roots = result.data.filter((p) => !p.is_reply);
      setPosts((old) => unique(after ? [...old, ...roots] : roots));
      setPostCursor(result.after);
      setMe(result.profile);
      if (!after) setSelected(old => roots.find(p => p.id === old?.id) || roots[0] || null);
    } catch (e) {
      setPostError((e as Error).message);
    } finally {
      setPostBusy(false);
    }
  }, []);
  // Initial synchronization with the remote API intentionally updates loading state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPosts();
  }, [loadPosts]);
  const loadReplies = useCallback(async (postId: string, after?: string) => {
    const version = ++requestVersion.current;
    setReplyBusy(true);
    setReplyError("");
    try {
      const result = await api<ThreadPage>(
        `/api/threads?postId=${postId}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (version !== requestVersion.current) return;
      setReplies((old) =>
        unique(after ? [...old, ...result.data] : result.data),
      );
      setReplyCursor(result.after);
    } catch (e) {
      if (version === requestVersion.current)
        setReplyError((e as Error).message);
    } finally {
      if (version === requestVersion.current) setReplyBusy(false);
    }
  }, []);
  useEffect(() => {
    // Reset conversation-specific state when selecting a different remote resource.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReplies([]);
    generationVersion.current++;
    setGenerating(null);
    setReplyCursor(null);
    setTarget(null);
    setDraft("");
    setSendError("");
    setNotice("");
    conversationScroll.current?.scrollTo({ top: 0 });
    if (selected) void loadReplies(selected.id);
    else {
      requestVersion.current++;
      setReplyBusy(false);
    }
  }, [selected, loadReplies]);
  async function generate(reply: Thread, replaceDraft = false) {
    if (!selected || busy || postBusy || (target && draft.trim() && !replaceDraft)) return;
    const version = ++generationVersion.current;
    setGenerating(reply.id);
    setTarget(reply);
    setSendError("");
    setNotice("");
    try {
      const result = await api<{ text: string }>("/api/gemini/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: selected.id, replyId: reply.id, instructions }),
      });
      if (version !== generationVersion.current) return;
      setDraft(result.text);
    } catch (e) {
      if (version === generationVersion.current) setSendError((e as Error).message);
    } finally {
      if (version === generationVersion.current) setGenerating(null);
    }
  }
  function insertEmoji(emoji: string) {
    if (busy) return;
    const input = textarea.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (Array.from(next.trim()).length > 500) {
      setSendError("This emoji would exceed the 500-character reply limit.");
      return;
    }
    setDraft(next);
    setSendError("");
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
  async function send() {
    if (!selected || !target || busy) return;
    setSending(true);
    setSendError("");
    setNotice("");
    try {
      await api("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selected.id,
          replyId: target.id,
          text: draft,
        }),
      });
      setDraft("");
      setTarget(null);
      setNotice("Reply published. Threads may take a moment to show it.");
      await loadReplies(selected.id);
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  function renderReply({ reply, children }: ReplyNode) {
    const parent = replies.find(r => r.id === reply.replied_to?.id);
    return (
                        <article
                          key={reply.id}
                          className={`reply ${reply.is_reply_owned_by_me ? "own-reply" : "user-reply"} ${target?.id === reply.id ? "chosen" : ""}`}
                        >
                          <div className="author">
                            <span
                              className={`avatar ${reply.is_reply_owned_by_me ? "own" : ""}`}
                            >
                              {(reply.username || "?")[0].toUpperCase()}
                            </span>
                            <div>
                              <strong>
                                @{reply.username || "Threads user"}{" "}
                                {reply.is_reply_owned_by_me && (
                                  <span className="you">YOU</span>
                                )}
                              </strong>
                              <time>{date(reply.timestamp)}</time>
                            </div>
                          </div>
                          {reply.replied_to?.id !== selected?.id &&
                            reply.replied_to && (
                              <div className="parent">
                                ↳ Replying to{" "}
                                {parent
                                  ? `@${parent.username}`
                                  : "an earlier comment (load more replies for context)"}
                              </div>
                            )}
                          <p>{reply.text}</p>
                          <Media item={reply} />
                          <div className="root-actions">
                            <div className="comment-actions">
                            <button
                              disabled={busy}
                              onClick={() => {
                                setTarget(reply);
                                setSendError("");
                                setNotice("");
                              }}
                            >
                              ↩ Reply
                            </button>
                            <button
                              type="button"
                              className={`gemini-button ${generating === reply.id ? "generating" : ""}`}
                              aria-label={generating === reply.id ? "Generating reply with Gemini" : "Generate reply with Gemini"}
                              aria-busy={generating === reply.id}
                              title={target && draft.trim() ? "Finish or close your current draft first" : "Generate reply with Gemini"}
                              disabled={busy || postBusy || !!(target && draft.trim()) || !reply.text?.trim()}
                              onClick={() => void generate(reply)}
                            >
                              <img src="/gemini-logo.png" alt="" width={18} height={18} />
                            </button>
                            </div>
                            {reply.permalink && (
                              <a
                                href={reply.permalink}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open ↗
                              </a>
                            )}
                          </div>
                          {children.length > 0 && <div className="reply-branches">{children.map(renderReply)}</div>}
                        </article>
    );
  }
  const visible = posts.filter((p) =>
    `${p.text || ""} ${p.username || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const count = Array.from(draft.trim()).length;
  return (
    <div className="shell" data-theme={theme}>
      <aside className="rail">
        <Link className="brand" href="/" aria-label="Threads inbox">
          @
        </Link>
        <Link className="rail-icon" href="/" title="Conversations" aria-label="Conversations">☰</Link>
        <button className="rail-bottom theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          {theme === "light" ? "☾" : "☀"}
        </button>
      </aside>
      <main className="workspace">
        <div className="inbox">
          <section className="post-pane">
            <div className="pane-title">
              <div>
                <h2>Your posts</h2>
                <span className="sort-label">{me ? `@${me.username}` : "Connecting…"} · {posts.length} loaded</span>
              </div>
              <button className="secondary" disabled={postBusy || busy} onClick={() => void loadPosts()} aria-label="Refresh posts">
                ↻ {postBusy ? "Syncing…" : "Refresh"}
              </button>
            </div>
            <label className="search">
              <span>⌕</span>
              <input
                placeholder="Search loaded posts…"
                aria-label="Search posts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {postError && (
              <div className="error" role="alert">
                {postError}
                <button onClick={() => void loadPosts()}>Try again</button>
              </div>
            )}
            {postBusy && !posts.length && (
              <div className="empty">Loading your posts…</div>
            )}
            {!postBusy && !postError && !visible.length && (
              <div className="empty">
                {search
                  ? "No matching posts."
                  : "No posts yet. Your published Threads will appear here."}
              </div>
            )}
            <div className="post-list">
              {visible.map((post) => (
                <button
                  key={post.id}
                  disabled={busy}
                  className={`post-card ${selected?.id === post.id ? "active" : ""}`}
                  onClick={() => setSelected(post)}
                >
                  <div className="post-meta">
                    <strong>@{post.username || me?.username}</strong>
                    <span>↗</span>
                  </div>
                  <p>{post.text || "Media post"}</p>
                  <time>{date(post.timestamp)}</time>
                  <div className="post-foot">
                    {post.has_replies ? "◌ Has replies" : "◌ Open conversation"}
                    <span>→</span>
                  </div>
                </button>
              ))}
            </div>
            {postCursor && (
              <button
                className="load"
                disabled={postBusy || busy}
                onClick={() => void loadPosts(postCursor)}
              >
                {postBusy ? "Loading…" : "Load 10 more posts"}
              </button>
            )}
           
          </section>
          <section className="conversation" aria-label="Selected conversation">
            <div className="pane-title">
              <h2>Conversation</h2><button className="mobile-theme theme-toggle" onClick={toggleTheme} type="button" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "☾" : "☀"}</button>
              {selected && (
                <span className="badge">{replies.length} replies loaded</span>
              )}
            </div>
            <div className="conversation-scroll" ref={conversationScroll}>
              {!selected ? (
                <div className="empty large">
                  Select a post to start exploring its replies.
                </div>
              ) : (
                <>
                  <article className="root-post">
                    <div className="author">
                      <span className="avatar">
                        {(selected.username || "T")[0].toUpperCase()}
                      </span>
                      <div>
                        <strong>@{selected.username}</strong>
                        <time>{date(selected.timestamp)}</time>
                      </div>
                      <span className="you">YOUR POST</span>
                    </div>
                    <p>{selected.text}</p>
                    <Media item={selected} />
                    <div className="root-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setTarget(selected);
                          setSendError("");
                          setNotice("");
                        }}
                      >
                        ↩ Reply to post
                      </button>
                      {selected.permalink && (
                        <a
                          href={selected.permalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Threads ↗
                        </a>
                      )}
                    </div>
                  </article>
                  <div className="reply-heading">
                    <div>
                      <h3>Replies</h3>
                      <span className="sort-label">Newest comments first · replies grouped underneath</span>
                    </div>
                    <button
                      disabled={replyBusy || busy}
                      onClick={() => void loadReplies(selected.id)}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                  {replyError && (
                    <div className="error" role="alert">
                      {replyError}
                      <button onClick={() => void loadReplies(selected.id)}>
                        Try again
                      </button>
                    </div>
                  )}
                  {replyBusy && !replies.length && (
                    <div className="empty">Loading conversation…</div>
                  )}
                  {!replyBusy && !replyError && !replies.length && (
                    <div className="empty">
                      No replies yet. The conversation starts here.
                    </div>
                  )}
                  <div className="reply-list">
                    {replyTree(replies).map(renderReply)}
                  </div>
                  {replyCursor && (
                    <button
                      className="load"
                      disabled={replyBusy || busy}
                      onClick={() => void loadReplies(selected.id, replyCursor)}
                    >
                      {replyBusy ? "Loading…" : "Load more replies"}
                    </button>
                  )}
                  {notice && (
                    <div className="success" role="status">
                      {notice}
                    </div>
                  )}
                </>
              )}
            </div>
            {selected && target && (
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="composer-title">
                  <strong>
                    Replying to @{target.username || me?.username}
                  </strong>
                  <button
                    type="button"
                    aria-label="Close reply composer"
                    disabled={busy}
                    onClick={() => setTarget(null)}
                  >
                    ✕
                  </button>
                </div>
                <blockquote>{target.text || "Media post"}</blockquote>
                {target.id !== selected.id && <details className="gemini-instructions">
                  <summary>Gemini instructions <span>Optional</span></summary>
                  <label htmlFor="gemini-instructions">Guide the next draft</label>
                  <textarea id="gemini-instructions" className="instructions-input" rows={2} maxLength={1000}
                    placeholder="e.g. Reply in Hindi, keep it short, no emojis."
                    value={instructions} disabled={busy} onChange={e => setInstructions(e.target.value)} />
                  <div className="instructions-actions">
                    <span>{Array.from(instructions).length}/1,000</span>
                    {instructions && <button type="button" disabled={busy} onClick={() => setInstructions("")}>Clear</button>}
                    <button type="button" className="generate-draft" disabled={busy || postBusy || !target.text?.trim()}
                      onClick={() => void generate(target, true)}>
                      <img src="/gemini-logo.png" alt="" width={16} height={16} />
                      {generating ? "Generating…" : draft.trim() ? "Regenerate draft" : "Generate draft"}
                    </button>
                  </div>
                </details>}
                <textarea
                  ref={textarea}
                  autoFocus
                  key={target.id}
                  aria-label="Your reply"
                  placeholder={generating ? "Gemini is drafting a reply…" : "Keep the conversation going…"}
                  value={draft}
                  disabled={busy}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="compose-bottom">
                  <div className="composer-tools">
                    <EmojiControl key={target.id} theme={theme} disabled={busy} onSelect={insertEmoji} />
                    <span className={count > 500 ? "over-limit" : ""}>
                      {count}/500 · Publishes to Threads
                    </span>
                  </div>
                  <button
                    className="primary"
                    disabled={busy || !count || count > 500}
                    type="submit"
                  >
                    {sending ? "Publishing…" : "Publish reply ↗"}
                  </button>
                </div>
                {sendError && (
                  <div className="error" role="alert">
                    {sendError}
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
