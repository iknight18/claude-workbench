'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, PaperPlaneTilt, MagnifyingGlass, Check } from '@phosphor-icons/react';
import { fetchPrompts } from '@/lib/api/prompts';
import type { Prompt } from '@/lib/api/prompts';

interface ToolsPromptTabProps {
  onInsert?: (text: string) => void;
}

export default function ToolsPromptTab({ onInsert }: ToolsPromptTabProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchPrompts().then(setPrompts).catch(() => setPrompts([]));
  }, []);

  const filtered = prompts.filter(
    p =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase())
  );

  const expandedPrompt = prompts.find(p => p.id === expandedId);

  const getVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  };

  const resolveContent = useCallback(
    (content: string) => {
      return content.replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] || `{{${name}}}`);
    },
    [variables]
  );

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setVariables({});
    } else {
      setExpandedId(id);
      setVariables({});
      setCopied(false);
    }
  };

  const handleCopy = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(resolveContent(content));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [resolveContent]
  );

  const handleInsert = useCallback(
    (content: string) => {
      onInsert?.(resolveContent(content));
    },
    [onInsert, resolveContent]
  );

  // Render preview content with variable highlighting
  const renderPreview = (content: string) => {
    const parts = content.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) => {
      const match = part.match(/^\{\{(\w+)\}\}$/);
      if (match) {
        const name = match[1];
        const filled = variables[name];
        if (filled) {
          return (
            <span key={i} className="text-emerald-400">{filled}</span>
          );
        }
        return (
          <span key={i} className="text-amber-400/70">{`{{${name}}}`}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-zinc-800/50">
        <div className="relative">
          <MagnifyingGlass
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
            No prompts found
          </div>
        ) : (
          filtered.map(prompt => (
            <div key={prompt.id} className="border-b border-zinc-800/30">
              <button
                onClick={() => handleExpand(prompt.id)}
                className={`w-full text-left px-3 py-2 hover:bg-zinc-800/30 transition-colors ${
                  expandedId === prompt.id ? 'bg-zinc-800/30' : ''
                }`}
              >
                <div className="text-xs font-medium text-zinc-300 truncate">
                  {prompt.title}
                </div>
                <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                  {prompt.content.slice(0, 60)}
                </div>
                {prompt.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {prompt.tags.slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {expandedId === prompt.id && expandedPrompt && (
                <div className="px-3 pt-2 pb-3">
                  {/* Variables — stacked vertically */}
                  {getVariables(expandedPrompt.content).length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Variables
                      </div>
                      {getVariables(expandedPrompt.content).map(v => (
                        <div key={v}>
                          <label className="block text-[10px] text-emerald-500/80 font-mono mb-0.5">
                            {v}
                          </label>
                          <input
                            type="text"
                            value={variables[v] || ''}
                            onChange={e =>
                              setVariables(prev => ({
                                ...prev,
                                [v]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${v}...`}
                            className="w-full px-2 py-1 text-[11px] bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview with highlighting */}
                  <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto mb-2 p-2 bg-zinc-900 rounded border border-zinc-800">
                    {renderPreview(expandedPrompt.content)}
                  </pre>

                  {/* Action buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopy(expandedPrompt.content)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-800 rounded transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check size={10} className="text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleInsert(expandedPrompt.content)}
                      disabled={!onInsert}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 rounded transition-colors disabled:opacity-40"
                    >
                      <PaperPlaneTilt size={10} />
                      Insert
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
