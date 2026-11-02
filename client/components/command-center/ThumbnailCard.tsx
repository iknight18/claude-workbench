'use client';

import { useState, useEffect } from 'react';
import { Circle } from '@phosphor-icons/react';
import { fetchTerminalPreview } from '@/lib/api/sessions';
import type { Session } from '@/lib/api/sessions';

interface ThumbnailCardProps {
  sessionId: string;
  session: Session | undefined;
  isFocused: boolean;
  hasAttention: boolean;
  onClick: () => void;
  variant: 'vertical' | 'horizontal';
}

export default function ThumbnailCard({
  sessionId,
  session,
  isFocused,
  hasAttention,
  onClick,
  variant,
}: ThumbnailCardProps) {
  const [previewLines, setPreviewLines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const preview = await fetchTerminalPreview(sessionId);
        if (!cancelled) setPreviewLines(preview.lines);
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  const name = session?.name ?? sessionId.slice(0, 6);

  const borderColor = isFocused
    ? 'border-emerald-500'
    : hasAttention
    ? 'border-amber-500/50'
    : 'border-zinc-800';

  if (variant === 'horizontal') {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${borderColor} bg-zinc-900/50 whitespace-nowrap flex-shrink-0 hover:bg-zinc-800/50 transition-colors`}
      >
        <Circle
          size={6}
          weight="fill"
          className={hasAttention ? 'text-amber-500' : 'text-emerald-500'}
        />
        <span className={`text-[11px] ${isFocused ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {name}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2 rounded-md border ${borderColor} bg-zinc-900/30 hover:bg-zinc-800/40 transition-colors ${
        isFocused ? 'opacity-100' : 'opacity-70 hover:opacity-90'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] truncate ${isFocused ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {name}
        </span>
        <Circle
          size={6}
          weight="fill"
          className={hasAttention ? 'text-amber-500' : 'text-emerald-500'}
        />
      </div>
      {previewLines.length > 0 && (
        <div className="font-mono text-[9px] text-zinc-600 leading-tight space-y-0.5 overflow-hidden max-h-[32px]">
          {previewLines.slice(-2).map((line, i) => (
            <div key={i} className="truncate">{line}</div>
          ))}
        </div>
      )}
    </button>
  );
}
