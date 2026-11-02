'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  fetchUnreadCount,
  markAllRead as apiMarkAllRead,
  type Notification,
} from '@/lib/api/notifications';
import { getWsUrl } from '@/lib/api/client';

interface NotificationContextValue {
  unreadCount: number;
  openActivityWindow: () => void;
  resetUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  openActivityWindow: () => {},
  resetUnreadCount: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const activityWindowRef = useRef<Window | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load unread count on mount
  useEffect(() => {
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  // WebSocket connection — only for unread count updates in main window
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
            // Only increment if activity window is not open
            const activityOpen = activityWindowRef.current && !activityWindowRef.current.closed;
            if (!activityOpen) {
              setUnreadCount((c) => c + 1);
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const openActivityWindow = useCallback(() => {
    // If already open, focus it
    if (activityWindowRef.current && !activityWindowRef.current.closed) {
      activityWindowRef.current.focus();
      return;
    }

    // Open new popup
    const popup = window.open(
      '/activity',
      'activity-center',
      'width=400,height=700,menubar=no,toolbar=no,location=no,statusbar=no,resizable=yes'
    );
    activityWindowRef.current = popup;

    // Mark all as read since user is now watching
    apiMarkAllRead().then(() => setUnreadCount(0)).catch(() => {});
  }, []);

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        openActivityWindow,
        resetUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
