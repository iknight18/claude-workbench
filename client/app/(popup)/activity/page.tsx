'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import {
  fetchNotifications,
  deleteNotification,
  clearAll,
  markAllRead,
  type Notification,
} from '@/lib/api/notifications';
import { ArrowClockwise } from '@phosphor-icons/react';
import { apiFetch, getWsUrl } from '@/lib/api/client';
import SessionTracker from '@/components/activity/SessionTracker';
import NotificationFeed from '@/components/activity/NotificationFeed';
import { type ActiveSession, type RunningTask, type TaskEntry } from '@/components/activity/shared';

export default function ActivityPage() {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [runningTasks, setRunningTasks] = useState<RunningTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [refreshing, startRefresh] = useTransition();
  const [sessionTasks, setSessionTasks] = useState<Map<string, TaskEntry[]>>(new Map());
  const completionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const logRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);
  const knownIdsRef = useRef<Set<string>>(new Set());

  function addSessionTask(sessionName: string, subject: string, createdAt: string) {
    setSessionTasks((prev) => {
      const next = new Map(prev);
      const tasks = next.get(sessionName) ?? [];
      if (tasks.some((t) => t.subject === subject)) return prev;
      const updated = [...tasks, { subject, completed: false, created_at: createdAt }];
      updated.sort((a, b) => a.created_at.localeCompare(b.created_at));
      next.set(sessionName, updated);
      return next;
    });
  }

  function completeSessionTask(sessionName: string, subject: string) {
    setSessionTasks((prev) => {
      const next = new Map(prev);
      const tasks = next.get(sessionName);
      if (!tasks) return prev;
      const updated = tasks.map((t) =>
        t.subject === subject ? { ...t, completed: true } : t
      );
      next.set(sessionName, updated);
      return next;
    });

    const timerKey = `${sessionName}::${subject}`;
    const existing = completionTimers.current.get(timerKey);
    if (existing) clearTimeout(existing);
    completionTimers.current.set(
      timerKey,
      setTimeout(() => {
        setSessionTasks((prev) => {
          const next = new Map(prev);
          const tasks = next.get(sessionName);
          if (!tasks) return prev;
          const filtered = tasks.filter((t) => t.subject !== subject);
          if (filtered.length === 0) {
            next.delete(sessionName);
          } else {
            next.set(sessionName, filtered);
          }
          return next;
        });
        completionTimers.current.delete(timerKey);
      }, 1000)
    );
  }

  // Cleanup completion timers on unmount
  useEffect(() => {
    return () => {
      completionTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Mark all as read on mount
  useEffect(() => {
    markAllRead().catch(() => {});
  }, []);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications({ limit: 200 })
      .then((notifs) => {
        notifs.forEach((n) => knownIdsRef.current.add(n.id));
        setNotifications(notifs);
        const taskCreated = new Set<string>();
        const taskCompleted = new Set<string>();
        for (const n of notifs) {
          if (n.type === 'session_task_completed' && n.source) {
            taskCompleted.add(`${n.source}::${n.task_subject || n.message}`);
          }
          if (n.type === 'session_task_created' && n.source) {
            taskCreated.add(`${n.source}::${n.task_subject || n.message}`);
          }
        }
        const seedMap = new Map<string, TaskEntry[]>();
        for (const n of notifs) {
          if (n.type !== 'session_task_created' || !n.source) continue;
          const key = `${n.source}::${n.task_subject || n.message}`;
          if (taskCompleted.has(key)) continue;
          const tasks = seedMap.get(n.source) ?? [];
          const subject = n.task_subject || n.message;
          if (!tasks.some((t) => t.subject === subject)) {
            tasks.push({ subject, completed: false, created_at: n.created_at });
          }
          seedMap.set(n.source, tasks);
        }
        for (const [name, tasks] of seedMap) {
          seedMap.set(name, tasks.sort((a, b) => a.created_at.localeCompare(b.created_at)));
        }
        setSessionTasks(seedMap);
      })
      .catch(() => {});
  }, []);

  // Load running tasks on mount, then update via WebSocket events
  useEffect(() => {
    apiFetch<RunningTask[]>('/scheduler/tasks/running')
      .then(setRunningTasks)
      .catch(() => setRunningTasks([]));
  }, []);

  // WebSocket for notifications + terminal lifecycle + scheduler events
  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(`${getWsUrl()}/notifications/ws`);

      ws.onopen = () => {
        // Fetch current active sessions on connect/reconnect
        refreshActiveSessions();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'notification') {
            const notification = msg.data as Notification;
            setNotifications((prev) => [notification, ...prev]);

            if (!knownIdsRef.current.has(notification.id)) {
              knownIdsRef.current.add(notification.id);
              setFlashIds((prev) => new Set(prev).add(notification.id));
            }

            if (!isAtTopRef.current) {
              setShowScrollPill(true);
            }

            if (notification.type === 'session_task_created' && notification.source) {
              addSessionTask(notification.source, notification.task_subject || notification.message, notification.created_at);
            } else if (notification.type === 'session_task_completed' && notification.source) {
              completeSessionTask(notification.source, notification.task_subject || notification.message);
            }
          } else if (msg.type === 'terminal_started') {
            setActiveSessions((prev) => {
              if (prev.some((s) => s.sessionId === msg.sessionId)) return prev;
              return [...prev, { sessionId: msg.sessionId, name: msg.sessionName }];
            });
          } else if (msg.type === 'terminal_stopped') {
            setSessionTasks((prev) => {
              const next = new Map(prev);
              const session = activeSessions.find((s) => s.sessionId === msg.sessionId);
              if (session) next.delete(session.name);
              return next;
            });
            setActiveSessions((prev) =>
              prev.filter((s) => s.sessionId !== msg.sessionId)
            );
          } else if (msg.type === 'scheduler') {
            if (msg.event === 'task_started') {
              // Refresh running tasks list from server
              apiFetch<RunningTask[]>('/scheduler/tasks/running')
                .then(setRunningTasks)
                .catch(() => {});
            } else {
              // task_completed or task_failed — remove from running
              setRunningTasks((prev) => prev.filter((t) => t.id !== msg.taskId));
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Fetch active sessions (used on WS connect/reconnect)
  async function refreshActiveSessions() {
    try {
      const terminalIds = await apiFetch<string[]>('/terminals/active');
      if (terminalIds.length > 0) {
        const sessions = await apiFetch<any[]>('/sessions');
        const active = terminalIds
          .map((id) => {
            const s = sessions.find((s: any) => s.id === id);
            return s ? { sessionId: s.id, name: s.name } : null;
          })
          .filter(Boolean) as ActiveSession[];
        setActiveSessions(active);
      } else {
        setActiveSessions([]);
      }
    } catch {
      setActiveSessions([]);
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }, []);

  const dismissFlash = useCallback((id: string) => {
    setFlashIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      await clearAll();
      setNotifications([]);
    } catch {}
  }, []);

  const handleRefresh = useCallback(() => {
    startRefresh(async () => {
      try {
        const notifs = await fetchNotifications({ limit: 200 });
        knownIdsRef.current = new Set(notifs.map((n) => n.id));
        setNotifications(notifs);
      } catch {}
      await refreshActiveSessions();
    });
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Activity Center
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <ArrowClockwise size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <SessionTracker
        activeSessions={activeSessions}
        sessionTasks={sessionTasks}
        runningTasks={runningTasks}
      />

      <NotificationFeed
        notifications={notifications}
        flashIds={flashIds}
        showScrollPill={showScrollPill}
        onDismissFlash={dismissFlash}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
        onScrollStateChange={(atTop) => {
          isAtTopRef.current = atTop;
          if (atTop) setShowScrollPill(false);
        }}
        onScrollToTop={() => {
          logRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          setShowScrollPill(false);
        }}
        logRef={logRef}
      />
    </div>
  );
}
