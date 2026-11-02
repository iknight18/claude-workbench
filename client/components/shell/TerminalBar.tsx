'use client';

import { Terminal as TerminalIcon, X } from '@phosphor-icons/react';
import { useTerminals } from '@/lib/contexts/TerminalContext';

export default function TerminalBar() {
  const { terminals, panels, killTerminal, togglePanel } = useTerminals();

  if (terminals.size === 0) return null;

  const entries = Array.from(terminals.values());

  const handleSelect = (sessionId: string) => {
    togglePanel(sessionId);
  };

  const handleKill = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await killTerminal(sessionId);
  };

  return (
    <div className="h-8 bg-zinc-900 border-t border-zinc-800 flex items-center px-3 gap-2">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 flex-shrink-0">
        <TerminalIcon size={12} />
        <span>{entries.length}</span>
      </div>

      <div className="w-px h-3 bg-zinc-800" />

      <div className="flex items-center gap-1 overflow-x-auto min-w-0">
        {entries.map(entry => {
          const panel = panels.get(entry.sessionId);
          const isOpen = panel?.displayState === 'popup';

          return (
            <button
              key={entry.sessionId}
              onClick={() => handleSelect(entry.sessionId)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors flex-shrink-0 max-w-[180px] group ${
                isOpen
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  entry.status === 'running'
                    ? 'bg-emerald-500'
                    : entry.status === 'starting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-red-500'
                }`}
              />
              <span className="truncate">
                {entry.sessionName}
              </span>
              <X
                size={10}
                className="flex-shrink-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleKill(e as any, entry.sessionId)}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
