'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '@/lib/api/client';

interface SchedulerEvent {
  type: 'scheduler';
  event: 'task_started' | 'task_completed' | 'task_failed';
  taskId: string;
  runId: string;
}

/**
 * Listens for scheduler events on the notifications WebSocket
 * and calls the provided callback when a scheduler event arrives.
 */
export function useSchedulerEvents(
  onEvent: (event: SchedulerEvent) => void
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(`${getWsUrl()}/notifications/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'scheduler') {
            callbackRef.current(msg as SchedulerEvent);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        ws = null;
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
