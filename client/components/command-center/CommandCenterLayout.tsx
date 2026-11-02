'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import { fetchSessions, type Session } from '@/lib/api/sessions';
import { fetchActiveTerminals } from '@/lib/api/sessions';
import { type Notification } from '@/lib/api/notifications';
import { getWsUrl } from '@/lib/api/client';
import ActivityPanel from './ActivityPanel';
import FocusTerminal from './FocusTerminal';
import ThumbnailStrip from './ThumbnailStrip';

export default function CommandCenterLayout() {
  const { terminals } = useTerminals();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [attentionSessionIds, setAttentionSessionIds] = useState<Set<string>>(new Set());

  // Load sessions with active terminals
  useEffect(() => {
    async function load() {
      try {
        const [allSessions, activeIds] = await Promise.all([
          fetchSessions(),
          fetchActiveTerminals(),
        ]);
        const activeSessions = allSessions.filter(s => activeIds.includes(s.id));
        setSessions(activeSessions);
        if (activeIds.length > 0 && !focusedSessionId) {
          setFocusedSessionId(activeIds[0]);
        }
      } catch {}
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track permission prompts for attention system
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
            if (n.type === 'session_permission' && n.source_id) {
              setAttentionSessionIds(prev => new Set(prev).add(n.source_id));
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { destroyed = true; clearTimeout(reconnectTimer); };
  }, []);

  // Clear attention when session is focused
  useEffect(() => {
    if (focusedSessionId && attentionSessionIds.has(focusedSessionId)) {
      setAttentionSessionIds(prev => {
        const next = new Set(prev);
        next.delete(focusedSessionId);
        return next;
      });
    }
  }, [focusedSessionId, attentionSessionIds]);

  // Update focused session when terminals change
  useEffect(() => {
    if (focusedSessionId && !terminals.has(focusedSessionId)) {
      const firstActive = Array.from(terminals.keys())[0] ?? null;
      setFocusedSessionId(firstActive);
    }
  }, [terminals, focusedSessionId]);

  const handleFocusSession = useCallback((sessionId: string) => {
    setFocusedSessionId(sessionId);
  }, []);

  const terminalSessionIds = Array.from(terminals.keys());
  const focusedSession = sessions.find(s => s.id === focusedSessionId) ?? null;

  return (
    <div className="flex h-full">
      {/* Activity Panel */}
      <ActivityPanel
        expanded={activityExpanded}
        onToggle={() => setActivityExpanded(e => !e)}
        sessions={sessions}
        onFocusSession={handleFocusSession}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 text-xs">&#9654;</span>
            <span className="text-xs font-medium text-zinc-300">Command Center</span>
            <span className="text-[10px] text-zinc-500">
              {terminalSessionIds.length} session{terminalSessionIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Tablet: horizontal thumbnails above terminal */}
        <div className="md:hidden">
          <ThumbnailStrip
            sessionIds={terminalSessionIds}
            focusedSessionId={focusedSessionId}
            sessions={sessions}
            attentionSessionIds={attentionSessionIds}
            onFocusSession={handleFocusSession}
          />
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Focus terminal */}
          <div className="flex-1 min-w-0">
            {focusedSessionId ? (
              <FocusTerminal
                sessionId={focusedSessionId}
                session={focusedSession}
                hasPermissionPrompt={attentionSessionIds.has(focusedSessionId)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                No active terminals
              </div>
            )}
          </div>

          {/* Desktop: vertical thumbnails on right */}
          <div className="hidden md:block">
            <ThumbnailStrip
              sessionIds={terminalSessionIds}
              focusedSessionId={focusedSessionId}
              sessions={sessions}
              attentionSessionIds={attentionSessionIds}
              onFocusSession={handleFocusSession}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
