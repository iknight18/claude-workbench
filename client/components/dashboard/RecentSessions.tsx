'use client';

import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import type { Session } from '@/lib/api/sessions';

interface RecentSessionsProps {
  sessions: Session[];
  runningSessionIds: Set<string>;
}

export default function RecentSessions({ sessions, runningSessionIds }: RecentSessionsProps) {
  const router = useRouter();

  return (
    <div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
        Recent Sessions
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sessions.map((session) => {
          const isRunning = runningSessionIds.has(session.id);
          const subtitle = [session.group, session.profile]
            .filter(Boolean)
            .join(' \u00b7 ');

          return (
            <button
              key={session.id}
              onClick={() => router.push(`/sessions?select=${session.id}`)}
              className="text-left px-4 py-3 border border-zinc-800 rounded-lg hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isRunning ? 'bg-emerald-500' : 'bg-zinc-600'
                  }`}
                />
                <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-zinc-100">
                  {session.name}
                </span>
              </div>
              {subtitle && (
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {subtitle}
                </p>
              )}
            </button>
          );
        })}

        <button
          onClick={() => router.push('/sessions')}
          className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-zinc-800 rounded-lg hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
        >
          <Plus size={14} className="text-emerald-500" />
          <span className="text-sm text-emerald-500">New Session</span>
        </button>
      </div>
    </div>
  );
}
