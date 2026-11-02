'use client';

import { X, ClockCounterClockwise, ArrowCounterClockwise } from '@phosphor-icons/react';
import type { PromptVersion } from '@/lib/api/prompts';

interface VersionDrawerProps {
  open: boolean;
  versions: PromptVersion[];
  loading: boolean;
  onClose: () => void;
  onRestore: (versionId: string) => void;
  onPreview: (version: PromptVersion | null) => void;
  previewingId: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VersionDrawer({
  open,
  versions,
  loading,
  onClose,
  onRestore,
  onPreview,
  previewingId,
}: VersionDrawerProps) {
  if (!open) return null;

  return (
    <div className="w-72 h-full border-l border-zinc-800 bg-zinc-900/50 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <ClockCounterClockwise size={16} />
          Version History
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-xs text-zinc-500">
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-zinc-500">
            No previous versions
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {versions.map(version => (
              <div
                key={version.id}
                onClick={() =>
                  onPreview(previewingId === version.id ? null : version)
                }
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  previewingId === version.id
                    ? 'bg-zinc-800/50'
                    : 'hover:bg-zinc-800/30'
                }`}
              >
                <p className="text-xs font-medium text-zinc-300 truncate">
                  {version.title || 'Untitled'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {formatDate(version.created_at)}
                </p>
                {version.content && (
                  <p className="text-[11px] text-zinc-500 mt-1 truncate">
                    {version.content.slice(0, 60)}
                  </p>
                )}

                {previewingId === version.id && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRestore(version.id);
                    }}
                    className="flex items-center gap-1 mt-2 px-2.5 py-1 text-xs bg-emerald-500/10 text-emerald-500 rounded-md hover:bg-emerald-500/20 transition-colors"
                  >
                    <ArrowCounterClockwise size={12} />
                    Restore this version
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
