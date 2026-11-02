'use client';

import { Circle, Square, SpinnerGap } from '@phosphor-icons/react';
import type { ActiveSession, RunningTask, TaskEntry } from './shared';

interface SessionTrackerProps {
  activeSessions: ActiveSession[];
  sessionTasks: Map<string, TaskEntry[]>;
  runningTasks: RunningTask[];
}

export default function SessionTracker({ activeSessions, sessionTasks, runningTasks }: SessionTrackerProps) {
  return (
    <div className="flex-shrink-0 border-b border-zinc-800 px-3 py-2 space-y-2 max-h-[50%] overflow-y-auto">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">Sessions</p>
      {activeSessions.length === 0 ? (
        <p className="text-[10px] text-zinc-500 pb-1">No active sessions</p>
      ) : (
        activeSessions.map((s) => {
          const tasks = sessionTasks.get(s.name) ?? [];

          return (
            <div key={s.sessionId} className="mb-2">
              <div className="flex items-center gap-1.5 py-0.5">
                <Circle size={6} weight="fill" className="text-emerald-500 flex-shrink-0" />
                <span className="text-[11px] font-medium text-zinc-300 truncate">{s.name}</span>
              </div>
              {tasks.length > 0 && (
                <div className="ml-3.5 space-y-0.5">
                  {tasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Square size={11} className={task.completed ? 'text-zinc-600 flex-shrink-0' : 'text-zinc-500 flex-shrink-0'} />
                      <span className={
                        task.completed
                          ? 'text-[10px] text-zinc-600 line-through truncate'
                          : 'text-[10px] text-zinc-300 truncate'
                      }>
                        {task.subject}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="text-[9px] uppercase tracking-wider text-zinc-500 mt-2">Scheduled Tasks</p>
      {runningTasks.length === 0 ? (
        <p className="text-[10px] text-zinc-500">No running tasks</p>
      ) : (
        runningTasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <SpinnerGap size={10} className="text-zinc-400 animate-spin flex-shrink-0" />
              <span className="text-[11px] text-zinc-300 truncate">{t.name}</span>
            </div>
            <span className="text-[10px] text-zinc-500 flex-shrink-0 ml-2">running</span>
          </div>
        ))
      )}
    </div>
  );
}
