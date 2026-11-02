'use client';

import { useRef, useEffect } from 'react';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import { Stop as StopIcon, ArrowClockwise } from '@phosphor-icons/react';
import type { Session } from '@/lib/api/sessions';
import QuickActionBar from './QuickActionBar';

interface FocusTerminalProps {
  sessionId: string;
  session: Session | null;
  hasPermissionPrompt?: boolean;
}

export default function FocusTerminal({ sessionId, session, hasPermissionPrompt = false }: FocusTerminalProps) {
  const { attachTerminal, detachTerminal, killTerminal, startTerminal, terminals } = useTerminals();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Detach previous terminal
    if (prevSessionIdRef.current && prevSessionIdRef.current !== sessionId) {
      detachTerminal(prevSessionIdRef.current);
    }

    prevSessionIdRef.current = sessionId;

    if (!containerRef.current) return;

    // Small delay to let the container render at its final size
    const timer = setTimeout(() => {
      if (containerRef.current) {
        attachTerminal(sessionId, containerRef.current);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionId, attachTerminal, detachTerminal]);

  // Detach on unmount
  useEffect(() => {
    return () => {
      if (prevSessionIdRef.current) {
        detachTerminal(prevSessionIdRef.current);
      }
    };
  }, [detachTerminal]);

  const entry = terminals.get(sessionId);
  const name = session?.name ?? entry?.sessionName ?? sessionId.slice(0, 6);

  const handleKill = () => killTerminal(sessionId);
  const handleRestart = async () => {
    if (!session) return;
    await killTerminal(sessionId);
    await startTerminal(sessionId, session.name, session.profile);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 flex-shrink-0">
        <span className="text-xs font-medium text-emerald-400 truncate">{name}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleKill}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-500 hover:text-red-400 bg-zinc-800/50 rounded transition-colors"
          >
            <StopIcon size={10} /> Stop
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 rounded transition-colors"
          >
            <ArrowClockwise size={10} /> Restart
          </button>
        </div>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 min-h-0 bg-[#0a0a0b]" />

      {/* Quick actions */}
      <QuickActionBar sessionId={sessionId} hasPermissionPrompt={hasPermissionPrompt} />
    </div>
  );
}
