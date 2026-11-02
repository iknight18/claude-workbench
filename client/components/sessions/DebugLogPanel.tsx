'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowClockwise, MagnifyingGlass, Funnel, Trash } from '@phosphor-icons/react';
import { fetchDebugLogs, deleteDebugLogs, type DebugLogResult } from '@/lib/api/sessions';

interface DebugLogPanelProps {
  sessionId: string;
}

export default function DebugLogPanel({ sessionId }: DebugLogPanelProps) {
  const [data, setData] = useState<DebugLogResult>({ lines: [], categories: [], levels: [] });
  const [search, setSearch] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDebugLogs(sessionId, {
        search: search || undefined,
        level: selectedLevels.length > 0 ? selectedLevels.join(',') : undefined,
        category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      });
      setData(result);
    } catch {
      setData({ lines: [], categories: [], levels: [] });
    } finally {
      setLoading(false);
    }
  }, [sessionId, search, selectedLevels, selectedCategories]);

  // Initial load
  useEffect(() => {
    load();
  }, [sessionId]);

  // Debounced reload on filter changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, selectedLevels, selectedCategories]);

  // Auto-scroll to bottom on new data
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.lines]);

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  function getLineColor(line: string): string {
    if (line.includes('[ERROR]')) return 'text-red-400';
    if (line.includes('[WARN]')) return 'text-amber-400';
    return 'text-zinc-400';
  }

  return (
    <div className="flex flex-col h-full border-t border-zinc-800">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-950">
        <div className="relative flex-1">
          <MagnifyingGlass size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-7 pr-2 py-1 text-[11px] bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
          />
        </div>

        {/* Level filter */}
        <div className="relative">
          <button
            onClick={() => { setShowLevelFilter(!showLevelFilter); setShowCategoryFilter(false); }}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${
              selectedLevels.length > 0
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Funnel size={11} />
            Level
            {selectedLevels.length > 0 && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded">
                {selectedLevels.length}
              </span>
            )}
          </button>
          {showLevelFilter && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 overflow-hidden">
              {data.levels.map(level => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    selectedLevels.includes(level)
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {level}
                </button>
              ))}
              {data.levels.length === 0 && (
                <div className="px-3 py-1.5 text-[11px] text-zinc-600">No levels</div>
              )}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <button
            onClick={() => { setShowCategoryFilter(!showCategoryFilter); setShowLevelFilter(false); }}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${
              selectedCategories.length > 0
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Funnel size={11} />
            Category
            {selectedCategories.length > 0 && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded">
                {selectedCategories.length}
              </span>
            )}
          </button>
          {showCategoryFilter && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
              {data.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`block w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {data.categories.length === 0 && (
                <div className="px-3 py-1.5 text-[11px] text-zinc-600">No categories</div>
              )}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
        >
          <ArrowClockwise size={12} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Clear logs */}
        <button
          onClick={async () => {
            await deleteDebugLogs(sessionId);
            setData({ lines: [], categories: [], levels: [] });
          }}
          title="Clear debug logs"
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash size={12} />
        </button>
      </div>

      {/* Log lines */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed">
        {data.lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
            {loading ? 'Loading...' : 'No debug logs yet'}
          </div>
        ) : (
          data.lines.map((line, i) => (
            <div key={i} className={`${getLineColor(line)} whitespace-pre-wrap break-all hover:bg-zinc-800/30 px-1 rounded`}>
              {line}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {data.lines.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1 border-t border-zinc-800 text-[10px] text-zinc-600">
          <span>{data.lines.length} line{data.lines.length !== 1 ? 's' : ''}</span>
          {(selectedLevels.length > 0 || selectedCategories.length > 0 || search) && (
            <button
              onClick={() => { setSearch(''); setSelectedLevels([]); setSelectedCategories([]); }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
