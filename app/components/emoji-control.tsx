"use client";
import dynamic from 'next/dynamic';
import { Theme, EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  loading: () => <div className="emoji-loading" role="status">Loading emojis…</div>,
});
export default function EmojiControl({ theme, disabled, onSelect }: {
  theme: 'light' | 'dark'; disabled: boolean; onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 340, height: 360 });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); button.current?.focus(); }
    };
    const closeOnResize = () => setOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);
  function toggle() {
    if (open) { setOpen(false); return; }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 24);
    const height = Math.min(360, window.innerHeight - 32);
    setPosition({ width, height, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.top - height - 10, window.innerHeight - height - 12)) });
    setOpen(true);
  }
  function select(data: EmojiClickData) { onSelect(data.emoji); setOpen(false); }
  return <>
    <button ref={button} type="button" className={`emoji-toggle ${open ? 'is-open' : ''}`} disabled={disabled} onClick={toggle} aria-label="Choose an emoji" aria-expanded={open && !disabled} aria-haspopup="dialog" title="Add an emoji">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 14c1.2 3 6.8 3 8 0" /><path d="M8.5 8.5v2M15.5 8.5v2" /></svg>
    </button>
    {open && !disabled && createPortal(<div ref={panel} role="dialog" aria-label="Choose an emoji" className="emoji-popover" data-theme={theme} style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}>
      <Picker width={position.width} height={position.height} theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT} emojiStyle={EmojiStyle.NATIVE} onEmojiClick={select} searchPlaceholder="Search emojis…" previewConfig={{ showPreview: false }} />
    </div>, document.body)}
  </>;
}
