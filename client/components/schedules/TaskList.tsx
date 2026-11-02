'use client';

import { Plus, MagnifyingGlass } from '@phosphor-icons/react';
import SearchInput from '@/components/shared/SearchInput';
import type { ScheduledTask } from '@/lib/api/scheduler';

interface TaskListProps {
  tasks: ScheduledTask[];
  activeTaskId: string | null;
  runningTaskIds: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (task: ScheduledTask) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

function cronToLabel(cron: string): string {
  if (!cron) return 'Manual only';
  if (cron === '0 * * * *') return 'Hourly';

  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [min, hr, , , dow] = parts;
  const time = `${String(parseInt(hr) || 0).padStart(2, '0')}:${String(parseInt(min) || 0).padStart(2, '0')}`;

  if (dow === '1-5') return `Weekdays at ${time}`;
  if (dow === '*' && hr !== '*') return `Daily at ${time}`;
  if (dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[parseInt(dow)] || dow} at ${time}`;
  }

  return cron;
}

export default function TaskList({
  tasks,
  activeTaskId,
  runningTaskIds,
  searchQuery,
  onSearchChange,
  onSelect,
  onDelete,
  onCreate,
}: TaskListProps) {
  const filtered = tasks.filter(
    t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r border-zinc-800">
      <div className="flex flex-col gap-3 p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search tasks..."
          />
          <button
            onClick={onCreate}
            title="New Task"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors flex-shrink-0"
          >
            <Plus size={16} weight="bold" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-zinc-400 mb-1">No scheduled tasks</p>
            <p className="text-xs text-zinc-500 mb-3">Create one to automate Claude.</p>
            <button
              onClick={onCreate}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              New Task
            </button>
          </div>
        ) : (
          filtered.map(task => (
            <button
              key={task.id}
              onClick={() => onSelect(task)}
              className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors ${
                activeTaskId === task.id ? 'bg-zinc-800/30' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    runningTaskIds.has(task.id)
                      ? 'bg-amber-400 animate-pulse'
                      : task.enabled
                        ? 'bg-emerald-500'
                        : 'bg-zinc-600'
                  }`}
                />
                <span className="text-xs font-medium text-zinc-300 truncate">{task.name}</span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                {task.scheduled_at
                  ? `Once — ${new Date(task.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : cronToLabel(task.cron_expression)}

              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
