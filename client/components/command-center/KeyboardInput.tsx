'use client';

import { useState, useRef, useEffect } from 'react';
import { PaperPlaneTilt, X } from '@phosphor-icons/react';

interface KeyboardInputProps {
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function KeyboardInput({ onSend, onClose }: KeyboardInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-md px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <PaperPlaneTilt size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
