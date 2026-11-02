'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  startTerminal as apiStartTerminal,
  killTerminal as apiKillTerminal,
  fetchActiveTerminals,
  fetchSession,
} from '@/lib/api/sessions';
import { getWsUrl } from '@/lib/api/client';

export interface TerminalEntry {
  sessionId: string;
  sessionName: string;
  profile: string;
  status: 'starting' | 'running' | 'error';
}

interface XtermInstance {
  div: HTMLDivElement;
  terminal: any;
  fitAddon: any;
  webglAddon: any | null;
  ws: WebSocket | null;
  resizeObserver: ResizeObserver | null;
}

export interface PanelState {
  displayState: 'minimized' | 'popup';
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface TerminalContextValue {
  terminals: Map<string, TerminalEntry>;
  startTerminal: (sessionId: string, sessionName: string, profile: string) => Promise<void>;
  killTerminal: (sessionId: string) => Promise<void>;
  attachTerminal: (sessionId: string, container: HTMLDivElement) => void;
  detachTerminal: (sessionId: string, fromContainer?: HTMLDivElement) => void;
  writeToTerminal: (sessionId: string, data: string) => void;
  focusTerminal: (sessionId: string) => void;
  panels: Map<string, PanelState>;
  focusedPanelId: string | null;
  togglePanel: (sessionId: string) => void;
  focusPanel: (sessionId: string) => void;
  updatePanelPosition: (sessionId: string, position: { x: number }) => void;
  updatePanelSize: (sessionId: string, size: { width: number; height: number }) => void;
  popups: Set<string>;
  openTerminalPopup: (sessionId: string) => void;
  closeTerminalPopup: (sessionId: string) => void;
}

const TerminalContext = createContext<TerminalContextValue>({
  terminals: new Map(),
  startTerminal: async () => {},
  killTerminal: async () => {},
  attachTerminal: () => {},
  detachTerminal: () => {},
  writeToTerminal: () => {},
  focusTerminal: () => {},
  panels: new Map(),
  focusedPanelId: null,
  togglePanel: () => {},
  focusPanel: () => {},
  updatePanelPosition: () => {},
  updatePanelSize: () => {},
  popups: new Set(),
  openTerminalPopup: () => {},
  closeTerminalPopup: () => {},
});

export function useTerminals() {
  return useContext(TerminalContext);
}

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

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [terminals, setTerminals] = useState<Map<string, TerminalEntry>>(new Map());
  const [panels, setPanels] = useState<Map<string, PanelState>>(new Map());
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [popups, setPopups] = useState<Set<string>>(new Set());
  const popupWindowsRef = useRef<Map<string, Window>>(new Map());
  const instancesRef = useRef<Map<string, XtermInstance>>(new Map());
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const zIndexCounterRef = useRef(100);
  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  useEffect(() => {
    const recover = async () => {
      try {
        const activeIds = await fetchActiveTerminals();
        for (const id of activeIds) {
          // Fetch session details to get the real name and profile
          let sessionName = id.slice(0, 6);
          let profile = '';
          try {
            const session = await fetchSession(id);
            sessionName = session.name;
            profile = session.profile;
          } catch {
            // Use fallback if session fetch fails
          }
          const entry: TerminalEntry = {
            sessionId: id,
            sessionName,
            profile,
            status: 'starting',
          };
          setTerminals(prev => {
            const next = new Map(prev);
            next.set(id, entry);
            return next;
          });
          await createXtermInstance(id);
        }
      } catch {
        // ignore recovery errors
      }
    };
    recover();

    return () => {
      for (const [, inst] of instancesRef.current) {
        inst.ws?.close();
        inst.resizeObserver?.disconnect();
        inst.terminal?.dispose();
      }
      instancesRef.current.clear();
    };
  }, []);

  const getDefaultPanelState = useCallback((): PanelState => {
    const openCount = Array.from(panelsRef.current.values()).filter(p => p.displayState === 'popup').length;
    const width = 360;
    const height = 650;
    const gap = 12;
    const x = window.innerWidth - (width + gap) * (openCount + 1);
    zIndexCounterRef.current += 1;
    return {
      displayState: 'popup',
      position: { x: Math.max(60, x), y: 0 },
      size: { width, height },
      zIndex: zIndexCounterRef.current,
    };
  }, []);

  const createXtermInstance = useCallback(async (sessionId: string) => {
    if (instancesRef.current.has(sessionId)) return;
    if (!hiddenContainerRef.current) return;

    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');
    const { WebglAddon } = await import('@xterm/addon-webgl');

    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.padding = '8px';
    div.style.overflow = 'hidden';
    hiddenContainerRef.current.appendChild(div);

    const fitAddon = new FitAddon();
    const terminal = new Terminal({
      theme: XTERM_THEME,
      ...XTERM_OPTIONS,
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(div);

    let webglAddon: any = null;
    try {
      webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch {
      webglAddon = null;
    }

    const ws = new WebSocket(`${getWsUrl()}/terminals/${sessionId}`);

    ws.onopen = () => {
      setTerminals(prev => {
        const next = new Map(prev);
        const entry = next.get(sessionId);
        if (entry) {
          next.set(sessionId, { ...entry, status: 'running' });
        }
        return next;
      });
      if (terminal.cols && terminal.rows) {
        ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'output') {
          terminal.write(message.data);
        } else if (message.type === 'exit') {
          cleanupInstance(sessionId);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      setTerminals(prev => {
        const next = new Map(prev);
        const entry = next.get(sessionId);
        if (entry) {
          next.set(sessionId, { ...entry, status: 'error' });
        }
        return next;
      });
    };

    ws.onclose = () => {
      const inst = instancesRef.current.get(sessionId);
      if (inst) {
        cleanupInstance(sessionId);
      }
    };

    // Handle clipboard shortcuts (Ctrl+C/V/A) so they work in the terminal
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return true;

      // Ctrl+C: copy if there's a selection, otherwise send SIGINT
      if (e.key === 'c' && e.type === 'keydown') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false; // prevent xterm from sending \x03
        }
        return true; // no selection → let xterm send SIGINT
      }

      // Ctrl+V: paste from clipboard
      if (e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: text }));
          }
        });
        return false;
      }

      // Ctrl+A: select all in terminal
      if (e.key === 'a' && e.type === 'keydown') {
        terminal.selectAll();
        return false;
      }

      return true;
    });

    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    instancesRef.current.set(sessionId, {
      div,
      terminal,
      fitAddon,
      webglAddon,
      ws,
      resizeObserver: null,
    });
  }, []);

  const openTerminalPopup = useCallback((sessionId: string) => {
    // If already open, focus it
    const existing = popupWindowsRef.current.get(sessionId);
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const popup = window.open(
      `/terminal/${sessionId}`,
      `terminal-${sessionId}`,
      'width=800,height=600,menubar=no,toolbar=no,location=no,statusbar=no,resizable=yes'
    );

    if (!popup) return;

    popupWindowsRef.current.set(sessionId, popup);
    setPopups((prev) => new Set(prev).add(sessionId));

    // Poll for popup close
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        popupWindowsRef.current.delete(sessionId);
        setPopups((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    }, 500);
  }, []);

  const closeTerminalPopup = useCallback((sessionId: string) => {
    const popup = popupWindowsRef.current.get(sessionId);
    if (popup && !popup.closed) {
      popup.close();
    }
    popupWindowsRef.current.delete(sessionId);
    setPopups((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const cleanupInstance = useCallback((sessionId: string) => {
    const inst = instancesRef.current.get(sessionId);
    if (!inst) return;

    // Close popup window if open
    const popup = popupWindowsRef.current.get(sessionId);
    if (popup && !popup.closed) popup.close();
    popupWindowsRef.current.delete(sessionId);
    setPopups((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });

    inst.ws?.close();
    inst.resizeObserver?.disconnect();
    inst.terminal?.dispose();
    inst.div.remove();
    instancesRef.current.delete(sessionId);

    setTerminals(prev => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });

    setPanels(prev => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const togglePanel = useCallback((sessionId: string) => {
    const current = panelsRef.current.get(sessionId);
    const isCurrentlyOpen = current?.displayState === 'popup';

    setPanels(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) {
        if (isCurrentlyOpen) {
          next.set(sessionId, { ...existing, displayState: 'minimized' });
        } else {
          zIndexCounterRef.current += 1;
          next.set(sessionId, { ...existing, displayState: 'popup', zIndex: zIndexCounterRef.current });
        }
      } else {
        next.set(sessionId, getDefaultPanelState());
      }
      return next;
    });

    if (isCurrentlyOpen) {
      setFocusedPanelId(f => f === sessionId ? null : f);
    } else {
      setFocusedPanelId(sessionId);
    }
  }, [getDefaultPanelState]);

  const focusPanel = useCallback((sessionId: string) => {
    setFocusedPanelId(sessionId);
    setPanels(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing && existing.displayState === 'popup') {
        zIndexCounterRef.current += 1;
        next.set(sessionId, { ...existing, zIndex: zIndexCounterRef.current });
      }
      return next;
    });
  }, []);

  const updatePanelPosition = useCallback((sessionId: string, position: { x: number }) => {
    setPanels(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) {
        next.set(sessionId, { ...existing, position: { ...existing.position, x: position.x } });
      }
      return next;
    });
  }, []);

  const updatePanelSize = useCallback((sessionId: string, size: { width: number; height: number }) => {
    setPanels(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId);
      if (existing) {
        next.set(sessionId, { ...existing, size });
      }
      return next;
    });
  }, []);

  const startTerminalFn = useCallback(async (sessionId: string, sessionName: string, profile: string) => {
    setTerminals(prev => {
      const next = new Map(prev);
      next.set(sessionId, { sessionId, sessionName, profile, status: 'starting' });
      return next;
    });

    try {
      await apiStartTerminal(sessionId);
      await createXtermInstance(sessionId);
    } catch (err) {
      setTerminals(prev => {
        const next = new Map(prev);
        next.set(sessionId, { sessionId, sessionName, profile, status: 'error' });
        return next;
      });
      throw err;
    }
  }, [createXtermInstance]);

  const killTerminalFn = useCallback(async (sessionId: string) => {
    try {
      await apiKillTerminal(sessionId);
    } catch {
      // Terminal may have already exited
    }
    cleanupInstance(sessionId);
  }, [cleanupInstance]);

  const attachTerminal = useCallback(async (sessionId: string, container: HTMLDivElement) => {
    const inst = instancesRef.current.get(sessionId);
    if (!inst) return;

    const prevCols = inst.terminal.cols;
    const prevRows = inst.terminal.rows;

    // Dispose WebGL addon before moving — its canvas retains stale pixels
    // (including old cursor position) when the div changes containers
    if (inst.webglAddon) {
      try { inst.webglAddon.dispose(); } catch { /* ignore */ }
      inst.webglAddon = null;
    }

    container.appendChild(inst.div);

    requestAnimationFrame(async () => {
      inst.fitAddon.fit();
      inst.terminal.scrollToBottom();
      const newCols = inst.terminal.cols;
      const newRows = inst.terminal.rows;

      // Notify PTY of new dimensions so the shell/app redraws naturally
      if ((newCols !== prevCols || newRows !== prevRows) && inst.ws?.readyState === WebSocket.OPEN) {
        inst.ws.send(JSON.stringify({
          type: 'resize',
          cols: newCols,
          rows: newRows,
        }));
      }

      // Recreate WebGL addon with fresh canvas
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        const newWebgl = new WebglAddon();
        inst.terminal.loadAddon(newWebgl);
        inst.webglAddon = newWebgl;
      } catch {
        // WebGL not available, falls back to canvas renderer
      }

      inst.terminal.focus();
    });

    if (inst.resizeObserver) {
      inst.resizeObserver.disconnect();
    }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      // Throttle fit() to one call per animation frame to avoid excessive
      // reflows during drag-resize
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          const prevCols = inst.terminal.cols;
          const prevRows = inst.terminal.rows;
          inst.fitAddon.fit();
          // Keep viewport anchored to bottom after resize — without this,
          // ConPTY pushes the viewport up when rows increase
          inst.terminal.scrollToBottom();

          const newCols = inst.terminal.cols;
          const newRows = inst.terminal.rows;
          if (newCols !== prevCols || newRows !== prevRows) {
            // On Windows, ConPTY re-emits buffer content after PTY resize.
            // xterm already reflowed its buffer via fit(), so the ConPTY
            // output would duplicate the scrollback. Clear both scrollback
            // (\x1b[3J) and visible screen (\x1b[2J) before the redraw.
            inst.terminal.write('\x1b[3J\x1b[2J\x1b[H');
            // Debounce the PTY resize signal so the shell/app redraws once
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              if (inst.ws?.readyState === WebSocket.OPEN) {
                inst.ws.send(JSON.stringify({
                  type: 'resize',
                  cols: newCols,
                  rows: newRows,
                }));
              }
            }, 50);
          }
        } catch {
          // ignore resize errors
        }
      });
    });
    observer.observe(container);
    inst.resizeObserver = observer;
  }, []);

  const detachTerminal = useCallback((sessionId: string, fromContainer?: HTMLDivElement) => {
    const inst = instancesRef.current.get(sessionId);
    if (!inst) return;

    // If a specific container is provided, only detach if the div is still
    // in that container. This prevents a stale cleanup (e.g. panel unmounting)
    // from ripping the terminal out of a new container (e.g. session editor)
    // that already attached it.
    if (fromContainer && inst.div.parentElement !== fromContainer) return;

    if (inst.resizeObserver) {
      inst.resizeObserver.disconnect();
      inst.resizeObserver = null;
    }

    if (hiddenContainerRef.current && inst.div.parentElement !== hiddenContainerRef.current) {
      hiddenContainerRef.current.appendChild(inst.div);
    }
  }, []);

  const writeToTerminal = useCallback((sessionId: string, data: string) => {
    const inst = instancesRef.current.get(sessionId);
    if (inst?.ws?.readyState === WebSocket.OPEN) {
      inst.ws.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const focusTerminal = useCallback((sessionId: string) => {
    const inst = instancesRef.current.get(sessionId);
    if (inst?.terminal) {
      inst.terminal.focus();
    }
  }, []);

  return (
    <TerminalContext.Provider
      value={{
        terminals,
        startTerminal: startTerminalFn,
        killTerminal: killTerminalFn,
        attachTerminal,
        detachTerminal,
        writeToTerminal,
        focusTerminal,
        panels,
        focusedPanelId,
        togglePanel,
        focusPanel,
        updatePanelPosition,
        updatePanelSize,
        popups,
        openTerminalPopup,
        closeTerminalPopup,
      }}
    >
      <div
        ref={hiddenContainerRef}
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px', height: '600px' }}
      />
      {children}
    </TerminalContext.Provider>
  );
}
