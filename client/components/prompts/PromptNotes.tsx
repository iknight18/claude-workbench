'use client';

import { useState } from 'react';
import { CaretDown, CaretUp, Notepad } from '@phosphor-icons/react';

interface PromptNotesProps {
  notes: string;
  onChange: (notes: string) => void;
  onBlur?: () => void;
}

export default function PromptNotes({ notes, onChange, onBlur }: PromptNotesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <Notepad size={14} />
        <span>Notes</span>
        {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
        {!expanded && notes && (
          <span className="text-zinc-600 truncate ml-1">
            — {notes.slice(0, 40)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <textarea
            value={notes}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder="Add notes about this prompt..."
            className="w-full h-24 px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none font-mono"
          />
        </div>
      )}
    </div>
  );
}
