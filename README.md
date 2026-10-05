# Threads Inbox

A personal inbox for your Threads posts and conversations, built with Next.js. Browse posts, view direct and nested replies, and publish text replies without leaving the inbox.

## Setup

Keep your existing credentials in `.env`:

```dotenv
THREADS_TOKEN=your_user_access_token
THREADS_APP_ID=your_threads_app_id
THREADS_APP_SECRET=your_threads_app_secret
```

The existing user token handles reading and publishing. The app ID and secret are not needed for these operations; they remain available for a future OAuth flow. No credentials are sent to the browser. `.env` is ignored by Git.

Your user token needs `threads_basic` and `threads_read_replies` to read posts and conversations. Reply publishing needs `threads_manage_replies` and the publishing permission `threads_content_publish`. If access is rejected, enable the permissions in your Meta app and generate a new token. App ID and secret alone do not grant permissions. The app reports expired tokens and permission errors; token renewal is manual.

Start the app when ready:

```bash
npm run dev
```

Open http://localhost:3000. API access is restricted to `localhost`, `127.0.0.1`, or IPv6 loopback. This is a single-account local tool. Add authentication and authorization before adapting it for public hosting. Do not expose the local server through a proxy or tunnel.

## Using the inbox

- Select a post to load its full conversation, including nested replies. Parent reply labels show the context of nested replies.
- Use **Load older posts** and **Load more replies** to page through all content available from the API. Posts load 10 at a time; conversation pages request up to 50 replies, newest first. Search covers loaded posts.
- Select **Reply** on any reply, or **Reply to post**, write up to 500 characters, then select **Publish reply**. This immediately publishes using your Threads account.
- Refresh posts or the conversation to check for new content. There is no background polling. Media attachments display when provided by the API; outgoing replies are text only.
- A failed send keeps your draft. If publication cannot be confirmed, refresh or check Threads before trying again to avoid duplicates.

## Validation

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

The test script mocks the network and never publishes live content. It checks pagination, nested conversations, localhost and origin checks, ownership validation, reply targets, create/publish behavior, and error sanitization.

If Turbopack encounters an environment error, the supported alternative is:

```bash
npm run build -- --webpack
```

The inherited Google font setup needs network access during production builds.

API reference: [Meta's official Threads collection](https://www.postman.com/meta/threads/collection/dht3nzz/threads-api).

## Gemini reply drafts

Set `GEMINI_API_KEY` in `.env`. The small Gemini icon beside each text comment generates an editable draft in the composer. It sends the selected comment, original post text, and parent reply text (when applicable) to Google's Gemini API. It never publishes automatically. Review the draft and select **Publish reply** to send it.

The default model is `gemini-3.5-flash-lite`. Set `GEMINI_MODEL` in `.env` to use another available text model. Restart your running app after changing environment settings. [Google's model reference](https://ai.google.dev/gemini-api/docs/models) lists current model availability.

Generation adapts to the comment's intent and language. It uses text context only; media-only comments have the icon disabled. Finish or close an open draft before generating another. API quota, missing keys, blocked output, and incomplete replies are shown in the composer. Gemini API usage is billed or quota-limited according to your Google AI project.

## Conversation layout and themes

Comments are arranged newest first, with replies connected beneath their loaded parent comments. Your replies use a distinct background and YOU label. If a parent is on an older page, its reply remains visible with an earlier-context label; loading more replies attaches it to the parent automatically.

The moon/sun control toggles light and dark mode. Your preference is saved locally in the browser; the first visit follows your system preference. The control is in the left rail on desktop and the conversation toolbar on mobile.

Comment likes are not implemented: no supported publishing-like endpoint or permission was found in the official Threads API reference. Use a comment's Open link to like it on Threads.

## Emoji replies

Use the smile icon in the reply composer's toolbar to open `emoji-picker-react`. Search, browse categories, and choose skin tones. Selecting an emoji inserts it at the cursor or replaces selected text, then returns focus to the reply. The picker follows light/dark mode and closes with Escape or a click outside. Emoji insertion respects the reply length limit and is disabled during generation or publication.

## Custom Gemini instructions

Open a comment's reply composer and expand **Gemini instructions**. Add optional guidance such as “Reply in Hindi, keep it short, no emojis,” then choose **Generate draft** or **Regenerate draft**. Regeneration replaces the draft only after a successful response; failures preserve your text. Instructions also apply to the comment's Gemini icon and stay available during the current inbox session until cleared. Instructions are limited to 1,000 characters and are sent to Gemini alongside conversation context. Publishing remains manual.

