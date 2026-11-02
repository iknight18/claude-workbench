'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus } from '@phosphor-icons/react';

interface TagEditorProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagEditor({ tags, allTags, onChange }: TagEditorProps) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      const filtered = allTags.filter(
        t =>
          t.toLowerCase().includes(value.toLowerCase()) &&
          !tags.includes(t)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setSuggestions([]);
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X size={10} weight="bold" />
          </button>
        </span>
      ))}

      {adding ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && input.trim()) addTag(input);
              if (e.key === 'Escape') {
                setAdding(false);
                setInput('');
                setSuggestions([]);
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setAdding(false);
                setInput('');
                setSuggestions([]);
              }, 150);
            }}
            placeholder="Add tag..."
            className="w-24 px-2 py-0.5 text-xs bg-zinc-900 border border-zinc-700 rounded-full text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s}
                  onMouseDown={e => {
                    e.preventDefault();
                    addTag(s);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-0.5 px-2 py-0.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <Plus size={10} weight="bold" />
          Tag
        </button>
      )}
    </div>
  );
}
