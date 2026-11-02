'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@/lib/api/sessions';
import ThumbnailCard from './ThumbnailCard';

interface ThumbnailStripProps {
  sessionIds: string[];
  focusedSessionId: string | null;
  sessions: Session[];
  attentionSessionIds: Set<string>;
  onFocusSession: (sessionId: string) => void;
}

export default function ThumbnailStrip({
  sessionIds,
  focusedSessionId,
  sessions,
  attentionSessionIds,
  onFocusSession,
}: ThumbnailStripProps) {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsTablet(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (sessionIds.length === 0) return null;

  const otherIds = sessionIds.filter(id => id !== focusedSessionId);
  if (otherIds.length === 0) return null;

  // Tablet: horizontal strip
  if (isTablet) {
    return (
      <div className="flex-shrink-0 border-b border-zinc-800 px-2 py-1.5 flex gap-2 overflow-x-auto">
        {sessionIds.map(id => (
          <ThumbnailCard
            key={id}
            sessionId={id}
            session={sessions.find(s => s.id === id)}
            isFocused={id === focusedSessionId}
            hasAttention={attentionSessionIds.has(id)}
            onClick={() => onFocusSession(id)}
            variant="horizontal"
          />
        ))}
      </div>
    );
  }

  // Desktop: vertical column
  return (
    <div className="w-[180px] flex-shrink-0 border-l border-zinc-800 p-2 space-y-2 overflow-y-auto">
      {otherIds.map(id => (
        <ThumbnailCard
          key={id}
          sessionId={id}
          session={sessions.find(s => s.id === id)}
          isFocused={false}
          hasAttention={attentionSessionIds.has(id)}
          onClick={() => onFocusSession(id)}
          variant="vertical"
        />
      ))}
    </div>
  );
}
