'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, SpinnerGap, CaretDown, CaretRight } from '@phosphor-icons/react';
import type { TaskRun } from '@/lib/api/scheduler';

interface RunHistoryProps {
  runs: TaskRun[];
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const statusConfig = {
  running: { icon: SpinnerGap, color: 'text-amber-500', spin: true },
  completed: { icon: CheckCircle, color: 'text-emerald-500', spin: false },
  failed: { icon: XCircle, color: 'text-red-500', spin: false },
  killed: { icon: XCircle, color: 'text-zinc-500', spin: false },
};

export default function RunHistory({ runs }: RunHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-zinc-600">
        No runs yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {runs.map(run => {
        const config = statusConfig[run.status];
        const Icon = config.icon;
        const expanded = expandedId === run.id;

        return (
          <div key={run.id}>
            <button
              onClick={() => setExpandedId(expanded ? null : run.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-zinc-800/30 rounded transition-colors"
            >
              {expanded ? <CaretDown size={10} className="text-zinc-600" /> : <CaretRight size={10} className="text-zinc-600" />}
              <Icon size={12} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
              <span className="text-zinc-400 flex-1 text-left">{formatTime(run.started_at)}</span>
              <span className="text-zinc-600">{formatDuration(run.started_at, run.finished_at)}</span>
              {run.tokens_in > 0 && (
                <span className="text-zinc-600">{run.tokens_in + run.tokens_out} tok</span>
              )}
              {run.cost_usd > 0 && (
                <span className="text-zinc-600">${run.cost_usd.toFixed(3)}</span>
              )}
            </button>

            {expanded && (
              <div className="mx-2 mb-2 space-y-1">
                {run.command && (
                  <div className="px-2 py-1.5 text-xs font-mono text-zinc-500 bg-zinc-900/50 border border-zinc-800/50 rounded">
                    <span className="text-zinc-600">$</span> {run.command}
                  </div>
                )}
                <pre className="p-2 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {run.output || '(no output)'}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
