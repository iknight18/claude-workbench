'use client';

import { useState, useRef, useEffect } from 'react';
import { CaretDown, User } from '@phosphor-icons/react';
import type { Profile } from '@/lib/api/profiles';

interface ProfileSelectorProps {
  value: string;
  profiles: Profile[];
  onChange: (profile: string) => void;
}

export default function ProfileSelector({
  value,
  profiles,
  onChange,
}: ProfileSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = profiles.find(p => p.name === value);
  const displayName = selected ? (selected.display_name || selected.name) : (profiles.length > 0 ? 'Select profile' : 'No profiles');

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => profiles.length > 0 && setOpen(!open)}
        className={`flex items-center gap-1 text-[11px] transition-colors ${
          profiles.length > 0 ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-600 cursor-default'
        }`}
      >
        <User size={11} className="text-zinc-600" />
        <span>{displayName}</span>
        {profiles.length > 0 && <CaretDown size={9} className="text-zinc-600" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-20 overflow-hidden">
          {profiles.map(p => (
            <button
              key={p.name}
              onClick={() => {
                onChange(p.name);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                value === p.name
                  ? 'text-emerald-400 bg-zinc-800/50'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {p.display_name || p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
