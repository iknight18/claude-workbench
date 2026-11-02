'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Circle,
  CheckCircle,
  XCircle,
  ShieldWarning,
  Stop,
  Clock,
  X,
} from '@phosphor-icons/react';
import {
  fetchNotifications,
  markAllRead,
  type Notification,
} from '@/lib/api/notifications';
import { getWsUrl } from '@/lib/api/client';
import type { Session } from '@/lib/api/sessions';

const typeIcons: Record<string, typeof CheckCircle> = {
  task_completed: CheckCircle,
  task_failed: XCircle,
  session_permission: ShieldWarning,
  session_stopped: Stop,
  session_idle: Clock,
};

const typeColors: Record<string, string> = {
  task_completed: 'text-emerald-500',
  task_failed: 'text-red-500',
  session_permission: 'text-amber-500',
  session_stopped: 'text-blue-500',
  session_idle: 'text-zinc-400',
};

function timeAgo(dateStr: string): string {
  const utcStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  const diff = Math.max(0, Date.now() - new Date(utcStr).getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface ActivityPanelProps {
  expanded: boolean;
  onToggle: () => void;
  sessions: Session[];
  onFocusSession: (sessionId: string) => void;
}

export default function ActivityPanel({
  expanded,
  onToggle,
  sessions,
  onFocusSession,
}: ActivityPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const isTouchRef = useRef(false);

  // Detect tablet
  useEffect(() => {
    isTouchRef.current = window.matchMedia('(max-width: 768px)').matches;
  }, []);

  // Load initial notifications
  useEffect(() => {
    fetchNotifications({ limit: 100 })
      .then(setNotifications)
      .catch(() => {});
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(`${getWsUrl()}/notifications/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notification') {
            const n = msg.data as Notification;
            setNotifications(prev => [n, ...prev.slice(0, 99)]);
            setUnreadCount(c => c + 1);
          }
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const handleMarkAllRead = () => {
    markAllRead().then(() => setUnreadCount(0)).catch(() => {});
  };

  const handleNotificationClick = (n: Notification) => {
    if (n.source_id) {
      onFocusSession(n.source_id);
      // Auto-collapse on tablet
      if (isTouchRef.current) {
        onToggle();
      }
    }
  };

  // Group notifications by session
  const grouped = new Map<string, Notification[]>();
  for (const n of notifications.filter(n => n.category !== 'session_task')) {
    const key = n.source || 'System';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
  }

  // Collapsed: icon strip with session status dots
  if (!expanded) {
    return (
      <div className="w-10 md:w-10 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center pt-3 gap-3">
        <button
          onClick={onToggle}
          className="relative text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-[8px] text-black font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <div className="w-px h-3 bg-zinc-800" />
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onFocusSession(s.id)}
            title={s.name}
          >
            <Circle
              size={8}
              weight="fill"
              className={
                notifications.some(n => n.source_id === s.id && n.type === 'session_permission' && !n.read)
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }
            />
          </button>
        ))}
      </div>
    );
  }

  // Expanded: full activity feed
  return (
    <div className="w-[180px] md:w-[220px] flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-medium">Activity</span>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Mark read
            </button>
          )}
          <button
            onClick={onToggle}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Array.from(grouped.entries()).map(([source, notifs]) => (
          <div key={source}>
            <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-zinc-600 bg-zinc-900/50 sticky top-0">
              {source}
            </div>
            {notifs.slice(0, 10).map(n => {
              const Icon = typeIcons[n.type] ?? CheckCircle;
              const color = typeColors[n.type] ?? 'text-zinc-400';
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30"
                >
                  <div className="flex items-start gap-1.5">
                    <Icon size={11} weight="fill" className={`${color} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-300 truncate">{n.title}</p>
                      <p className="text-[9px] text-zinc-600">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[10px] text-zinc-600">
            No activity yet
          </div>
        )}
      </div>
    </div>
  );
}
