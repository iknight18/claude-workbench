'use client';

import { useState, useRef, useEffect } from 'react';
import { Funnel, Check } from '@phosphor-icons/react';

interface TagFilterProps {
  allTags: string[];
  activeTags: string[];
  onToggle: (tag: string) => void;
}

export default function TagFilter({ allTags, activeTags, onToggle }: TagFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (allTags.length === 0) return null;

  const activeCount = activeTags.length;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition-colors ${
          activeCount > 0
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'text-zinc-500 hover:text-zinc-400'
        }`}
      >
        <Funnel size={13} />
        <span>Tags</span>
        {activeCount > 0 && (
          <span className="ml-0.5 px-1.5 py-px text-[10px] rounded-full bg-emerald-500/20 text-emerald-400">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-lg">
          {allTags.map(tag => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggle(tag)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left transition-colors ${
                  active
                    ? 'text-emerald-400'
                    : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <span className={`flex items-center justify-center w-3.5 h-3.5 rounded border ${
                  active
                    ? 'border-emerald-500/50 bg-emerald-500/15'
                    : 'border-zinc-700'
                }`}>
                  {active && <Check size={9} weight="bold" />}
                </span>
                <span>{tag}</span>
              </button>
            );
          })}

          {activeCount > 0 && (
            <>
              <div className="border-t border-zinc-800 my-1" />
              <button
                onClick={() => activeTags.forEach(tag => onToggle(tag))}
                className="w-full px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-400 text-left transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
