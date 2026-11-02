'use client';

import { useState } from 'react';
import { Trash, Terminal, CopySimple } from '@phosphor-icons/react';
import type { Session } from '@/lib/api/sessions';

interface SessionListItemProps {
  session: Session;
  active: boolean;
  hasRunningTerminal?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortenDirectory(dir: string): string {
  if (!dir) return 'No directory';
  const parts = dir.replace(/\\/g, '/').split('/');
  return `~/${parts[parts.length - 1]}`;
}

const statusDot: Record<string, string> = {
  active: 'bg-zinc-600',
  completed: 'bg-zinc-500',
  archived: 'bg-zinc-700',
};

export default function SessionListItem({
  session,
  active,
  hasRunningTerminal,
  onClick,
  onDelete,
  onDuplicate,
}: SessionListItemProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`group relative px-3 py-2.5 cursor-pointer border-l-2 transition-colors ${
        active
          ? 'border-l-emerald-500 bg-zinc-800/50'
          : 'border-l-transparent hover:bg-zinc-800/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasRunningTerminal ? 'bg-emerald-500' : (statusDot[session.status] ?? 'bg-zinc-700')}`}
            />
            <h4 className="text-sm font-medium text-zinc-200 truncate">
              {session.name || 'Untitled Session'}
            </h4>
          </div>
          <p className="text-xs text-zinc-600 truncate mt-0.5 pl-3.5">
            {shortenDirectory(session.directory)}
          </p>
          <div className="flex items-center gap-2 mt-1.5 pl-3.5">
            {session.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
              >
                {tag}
              </span>
            ))}
            {hasRunningTerminal && (
              <Terminal size={10} weight="fill" className="text-emerald-500" />
            )}
            <span className="text-[10px] text-zinc-600">
              {timeAgo(session.updated_at)}
            </span>
          </div>
        </div>

        {!confirming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={e => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate session"
              className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <CopySimple size={14} />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setConfirming(true);
              }}
              title="Delete session"
              className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div
          className="flex items-center gap-2 mt-2 text-xs"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-zinc-500">Delete?</span>
          <button
            onClick={() => onDelete()}
            className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
