'use client';

import { useState, useCallback } from 'react';
import {
  Gear,
  MagnifyingGlass,
  Skull,
  SpinnerGap,
  CheckCircle,
  WarningCircle,
  Trash,
} from '@phosphor-icons/react';
import { scanClaudeProcesses, killClaudeProcesses } from '@/lib/api/processes';
import type { ClaudeProcess, KillResult } from '@/lib/api/processes';
import { clearAllDebugLogs } from '@/lib/api/sessions';
import ProfileManager from '@/components/settings/ProfileManager';

type State = 'idle' | 'scanning' | 'results' | 'killing' | 'done';
type DebugState = 'idle' | 'clearing' | 'done';

export default function SettingsPage() {
  const [state, setState] = useState<State>('idle');
  const [processes, setProcesses] = useState<ClaudeProcess[]>([]);
  const [killResult, setKillResult] = useState<KillResult | null>(null);
  const [debugState, setDebugState] = useState<DebugState>('idle');
  const [debugCleared, setDebugCleared] = useState(0);

  const handleScan = useCallback(async () => {
    setState('scanning');
    try {
      const result = await scanClaudeProcesses();
      setProcesses(result);
      setState('results');
    } catch {
      setProcesses([]);
      setState('results');
    }
  }, []);

  const handleKill = useCallback(async () => {
    setState('killing');
    try {
      const result = await killClaudeProcesses(processes.map(p => p.pid));
      setKillResult(result);
      setState('done');
    } catch {
      setState('done');
      setKillResult({ killed: [], failed: processes.map(p => p.pid) });
    }
  }, [processes]);

  const handleReset = useCallback(() => {
    setState('idle');
    setProcesses([]);
    setKillResult(null);
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-2 mb-8">
          <Gear size={20} className="text-zinc-500" />
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Settings</h1>
        </div>

        {/* Profiles section */}
        <ProfileManager />

        {/* System section */}
        <div className="space-y-4 mt-8">
          <h2 className="text-sm font-medium text-zinc-300">System</h2>

          <div className="border border-zinc-800 rounded-lg p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">Claude Processes</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Scan and kill all Claude Code processes on this machine
                </p>
              </div>

              {(state === 'idle' || state === 'results' || state === 'done') && (
                <button
                  onClick={handleScan}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  <MagnifyingGlass size={12} />
                  Scan
                </button>
              )}

              {state === 'scanning' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500">
                  <SpinnerGap size={12} className="animate-spin" />
                  Scanning...
                </div>
              )}

              {state === 'killing' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500">
                  <SpinnerGap size={12} className="animate-spin" />
                  Killing...
                </div>
              )}
            </div>

            {/* Process list */}
            {state === 'results' && processes.length > 0 && (
              <div className="space-y-3">
                <div className="border border-zinc-800 rounded overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-3 py-1.5 w-20">PID</th>
                        <th className="text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-3 py-1.5">Args</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processes.map(proc => (
                        <tr key={proc.pid} className="border-b border-zinc-800/50 last:border-0">
                          <td className="px-3 py-1.5 text-[11px] font-mono text-zinc-400">{proc.pid}</td>
                          <td className="px-3 py-1.5 text-[11px] font-mono text-zinc-400 truncate max-w-[400px]" title={proc.args}>
                            {proc.args}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleKill}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <Skull size={14} />
                  Kill All ({processes.length})
                </button>
              </div>
            )}

            {/* No processes */}
            {state === 'results' && processes.length === 0 && (
              <div className="flex items-center gap-2 py-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs text-zinc-400">No Claude processes running</span>
              </div>
            )}

            {/* Kill result */}
            {state === 'done' && killResult && (
              <div className="space-y-2 py-2">
                {killResult.killed.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="text-xs text-zinc-400">
                      Killed {killResult.killed.length} process{killResult.killed.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                )}
                {killResult.failed.length > 0 && (
                  <div className="flex items-center gap-2">
                    <WarningCircle size={14} className="text-amber-500" />
                    <span className="text-xs text-zinc-400">
                      Failed to kill {killResult.failed.length} process{killResult.failed.length !== 1 ? 'es' : ''}: {killResult.failed.join(', ')}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleReset}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Scan again
                </button>
              </div>
            )}
          </div>

          {/* Debug Logs */}
          <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">Debug Logs</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Remove all debug log files from all sessions
                </p>
              </div>

              {debugState === 'idle' && (
                <button
                  onClick={async () => {
                    setDebugState('clearing');
                    try {
                      const result = await clearAllDebugLogs();
                      setDebugCleared(result.cleared);
                      setDebugState('done');
                    } catch {
                      setDebugState('done');
                      setDebugCleared(0);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <Trash size={12} />
                  Clear All
                </button>
              )}

              {debugState === 'clearing' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500">
                  <SpinnerGap size={12} className="animate-spin" />
                  Clearing...
                </div>
              )}
            </div>

            {debugState === 'done' && (
              <div className="flex items-center gap-2 py-1">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs text-zinc-400">
                  Cleared {debugCleared} log file{debugCleared !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setDebugState('idle')}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
