'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { X } from '@phosphor-icons/react';
import { getWsUrl, apiFetch } from '@/lib/api/client';

const XTERM_THEME = {
  background: '#0a0a0b',
  foreground: '#cccccc',
  cursor: '#aeafad',
  cursorAccent: '#0a0a0b',
  selectionBackground: 'rgba(255, 255, 255, 0.15)',
  selectionForeground: '#ffffff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

const XTERM_OPTIONS = {
  fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 1,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'block' as const,
  scrollback: 5000,
  windowsPty: {
    backend: 'conpty' as const,
    buildNumber: 26200,
  },
};

export default function TerminalPopupPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [sessionName, setSessionName] = useState('Terminal');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const containerRef = useRef<HTMLDivElement>(null);
  const destroyedRef = useRef(false);

  // Fetch session name
  useEffect(() => {
    apiFetch<any>(`/sessions/${sessionId}`)
      .then((s) => {
        setSessionName(s.name || 'Terminal');
        document.title = `Terminal — ${s.name}`;
      })
      .catch(() => {});
  }, [sessionId]);

  // Initialize xterm + WebSocket
  useEffect(() => {
    if (!containerRef.current) return;
    destroyedRef.current = false;

    let ws: WebSocket | null = null;
    let terminal: any = null;
    let fitAddon: any = null;
    let webglAddon: any = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let observer: ResizeObserver | null = null;

    async function init() {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');
      const { WebglAddon } = await import('@xterm/addon-webgl');

      if (destroyedRef.current) return;

      terminal = new Terminal({ theme: XTERM_THEME, ...XTERM_OPTIONS });
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      terminal.open(containerRef.current!);

      try {
        webglAddon = new WebglAddon();
        terminal.loadAddon(webglAddon);
      } catch {}

      fitAddon.fit();

      // Connect WebSocket
      ws = new WebSocket(`${getWsUrl()}/terminals/${sessionId}`);

      ws.onopen = () => {
        setStatus('connected');
        ws!.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output') {
            terminal.write(msg.data);
          } else if (msg.type === 'exit') {
            setStatus('disconnected');
          }
        } catch {}
      };

      ws.onclose = () => {
        setStatus('disconnected');
      };

      ws.onerror = () => {
        ws?.close();
      };

      // Terminal input
      terminal.onData((data: string) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      // Clipboard: Ctrl+C (copy or SIGINT), Ctrl+V (paste)
      terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'c' && e.type === 'keydown') {
          const selection = terminal.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            terminal.clearSelection();
            return false;
          }
        }
        if (e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data: text }));
            }
          });
          return false;
        }
        return true;
      });

      // Resize observer
      observer = new ResizeObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          try {
            const prevCols = terminal.cols;
            const prevRows = terminal.rows;
            fitAddon.fit();
            terminal.scrollToBottom();

            const newCols = terminal.cols;
            const newRows = terminal.rows;
            if (newCols !== prevCols || newRows !== prevRows) {
              // On Windows, ConPTY re-emits buffer content after PTY resize.
              // xterm already reflowed its buffer via fit(), so the ConPTY
              // output would duplicate the scrollback. Clear both scrollback
              // (\x1b[3J) and visible screen (\x1b[2J) before the redraw.
              terminal.write('\x1b[3J\x1b[2J\x1b[H');
              if (resizeTimer) clearTimeout(resizeTimer);
              resizeTimer = setTimeout(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'resize',
                    cols: newCols,
                    rows: newRows,
                  }));
                }
              }, 50);
            }
          } catch {}
        });
      });
      observer.observe(containerRef.current!);

      terminal.focus();
    }

    init();

    return () => {
      destroyedRef.current = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (rafId) cancelAnimationFrame(rafId);
      observer?.disconnect();
      ws?.close();
      try { webglAddon?.dispose(); } catch {}
      terminal?.dispose();
    };
  }, [sessionId]);

  const handleKill = useCallback(async () => {
    try {
      await apiFetch(`/sessions/${sessionId}/terminal`, { method: 'DELETE' });
      window.close();
    } catch {}
  }, [sessionId]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${
            status === 'connected' ? 'bg-emerald-500' :
            status === 'connecting' ? 'bg-amber-500 animate-pulse' :
            'bg-zinc-600'
          }`} />
          <span className="text-xs font-medium text-zinc-200 truncate">{sessionName}</span>
          {status === 'disconnected' && (
            <span className="text-[10px] text-zinc-600">disconnected</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleKill}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors rounded"
            title="Kill terminal"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ padding: '8px' }} />
    </div>
  );
}
