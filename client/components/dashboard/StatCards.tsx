'use client';

import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/contexts/NotificationContext';
import type { DashboardStats } from '@/lib/api/dashboard';

interface StatCardsProps {
  stats: DashboardStats | null;
  runningTerminals: number;
}

export default function StatCards({ stats, runningTerminals }: StatCardsProps) {
  const router = useRouter();
  const { openActivityWindow } = useNotifications();

  const cards = [
    {
      label: 'Sessions',
      value: stats?.activeSessions ?? '-',
      sub: runningTerminals > 0 ? `${runningTerminals} running` : undefined,
      subColor: 'text-emerald-500',
      onClick: () => router.push('/sessions'),
    },
    {
      label: 'Scheduler',
      value: stats?.scheduledTasks ?? '-',
      sub: stats && stats.failedTasks > 0 ? `${stats.failedTasks} failed` : undefined,
      subColor: 'text-red-500',
      onClick: () => router.push('/schedules'),
    },
    {
      label: 'Prompts',
      value: stats?.totalPrompts ?? '-',
      sub: undefined,
      subColor: '',
      onClick: () => router.push('/prompts'),
    },
    {
      label: 'Profiles',
      value: stats?.profiles ?? '-',
      sub: undefined,
      subColor: '',
      onClick: () => router.push('/settings'),
    },
    {
      label: 'Unread',
      value: stats?.unreadNotifications ?? '-',
      sub: undefined,
      subColor: '',
      valueColor: stats && stats.unreadNotifications > 0 ? 'text-amber-500' : 'text-zinc-100',
      onClick: openActivityWindow,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={card.onClick}
          className="text-left px-4 py-3 border border-zinc-800 rounded-lg hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="text-xs text-zinc-500 uppercase tracking-wider">
            {card.label}
          </div>
          <div className={`text-xl font-semibold mt-1 ${card.valueColor || 'text-zinc-100'}`}>
            {card.value}
          </div>
          {card.sub && (
            <div className={`text-xs mt-0.5 ${card.subColor}`}>
              {card.sub}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
