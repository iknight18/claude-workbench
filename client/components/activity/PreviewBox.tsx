'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface PreviewBoxProps {
  id: string;
  preview: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PreviewBox({ id, preview, isExpanded, onToggle }: PreviewBoxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > 60);
  }, [preview]);

  return (
    <div className="mt-1.5 bg-zinc-900 rounded px-2 py-1.5">
      <div className={isExpanded ? 'max-h-[200px] overflow-y-auto' : 'max-h-[60px] overflow-hidden flex flex-col justify-end'}>
        <div ref={contentRef} className="activity-preview text-[10px] font-mono text-zinc-400 leading-relaxed break-words">
          <ReactMarkdown>{preview}</ReactMarkdown>
        </div>
      </div>
      {overflows && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="text-[9px] text-zinc-500 hover:text-zinc-400 transition-colors mt-0.5"
        >
          {isExpanded ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  );
}
