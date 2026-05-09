'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialogue } from '@/store/dialogue';

const TYPE_INTERVAL_MS = 28;

export default function Dialogue() {
  const active = useDialogue((s) => s.active);
  const lines = useDialogue((s) => s.lines);
  const index = useDialogue((s) => s.index);
  const requestId = useDialogue((s) => s.requestId);

  const [shown, setShown] = useState('');
  const fullRef = useRef('');

  // Typewriter: re-runs whenever the requestId changes (line advance).
  useEffect(() => {
    if (!active) {
      setShown('');
      return;
    }
    const full = lines[index]?.text ?? '';
    fullRef.current = full;
    setShown('');
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) window.clearInterval(interval);
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [active, requestId, lines, index]);

  if (!active) return null;

  const line = lines[index];
  const isComplete = shown.length >= fullRef.current.length;

  const handleAdvance = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!isComplete) {
      // Skip typewriter — show full line immediately.
      setShown(fullRef.current);
    } else {
      useDialogue.getState().next();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      <div className="pointer-events-auto absolute inset-x-4 bottom-4 mx-auto max-w-2xl">
        <div
          onPointerDown={handleAdvance}
          className="relative cursor-pointer rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-950/95 via-purple-950/95 to-fuchsia-950/90 p-5 shadow-[0_8px_40px_rgba(170,80,220,0.35)] backdrop-blur"
        >
          {line?.speaker && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/90">
              {line.speaker}
            </div>
          )}
          <div
            className={
              'min-h-[3.5rem] text-base leading-relaxed ' +
              (line?.action ? 'italic text-violet-200/70' : 'text-violet-50')
            }
          >
            {shown}
            {!isComplete && <span className="ml-1 inline-block animate-pulse text-pink-300">▋</span>}
            {isComplete && (
              <span className="ml-2 inline-block animate-pulse text-pink-300/80">▾</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
