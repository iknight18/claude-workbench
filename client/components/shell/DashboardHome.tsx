'use client';

import { useState, useEffect } from 'react';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import { fetchDashboardStats } from '@/lib/api/dashboard';
import { fetchSessions } from '@/lib/api/sessions';
import type { DashboardStats } from '@/lib/api/dashboard';
import type { Session } from '@/lib/api/sessions';
import StatCards from '@/components/dashboard/StatCards';
import RecentSessions from '@/components/dashboard/RecentSessions';

export default function DashboardHome() {
  const { terminals } = useTerminals();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats(null));

    fetchSessions({ status: 'active' })
      .then((sessions) => setRecentSessions(sessions.slice(0, 6)))
      .catch(() => setRecentSessions([]));
  }, []);

  const runningSessionIds = new Set(
    Array.from(terminals.keys())
  );

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight mb-1">
          Claude Workbench
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Personal AI development workbench
        </p>

        <div className="flex flex-col gap-6">
          <StatCards stats={stats} runningTerminals={terminals.size} />
          <RecentSessions
            sessions={recentSessions}
            runningSessionIds={runningSessionIds}
          />
        </div>
      </div>
    </div>
  );
}
