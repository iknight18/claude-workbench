'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowsOut,
  ArrowClockwise,
  Minus,
  X,
  Browser,
} from '@phosphor-icons/react';
import { useTerminals, type PanelState, type TerminalEntry } from '@/lib/contexts/TerminalContext';

const MIN_WIDTH = 250;
const MIN_HEIGHT = 150;
const BAR_HEIGHT = 32; // h-8 terminal bar
const SIDEBAR_WIDTH = 48; // sidebar width

interface TerminalPanelProps {
  entry: TerminalEntry;
  panel: PanelState;
}

export default function TerminalPanel({ entry, panel }: TerminalPanelProps) {
  const router = useRouter();
  const {
    focusedPanelId,
    startTerminal,
    killTerminal,
    attachTerminal,
    detachTerminal,
    togglePanel,
    focusPanel,
    updatePanelPosition,
    updatePanelSize,
    openTerminalPopup,
  } = useTerminals();

  const panelRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; origX: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origW: number;
    origH: number;
    edges: { top?: boolean; left?: boolean; right?: boolean };
  } | null>(null);

  const isRunning = entry.status === 'running';

  // Attach/detach terminal to this panel's slot
  useEffect(() => {
    if (!isRunning || !slotRef.current) return;
    const container = slotRef.current;

    attachTerminal(entry.sessionId, container);

    return () => {
      detachTerminal(entry.sessionId, container);
    };
  }, [entry.sessionId, isRunning, attachTerminal, detachTerminal]);

  // Clamp panel x to viewport on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const maxX = window.innerWidth - 100;
      if (panel.position.x > maxX) {
        updatePanelPosition(entry.sessionId, {
          x: Math.min(panel.position.x, maxX),
        });
      }
      // Clamp height to available space
      const maxH = window.innerHeight - BAR_HEIGHT;
      if (panel.size.height > maxH) {
        updatePanelSize(entry.sessionId, {
          width: panel.size.width,
          height: maxH,
        });
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [entry.sessionId, panel.position, panel.size, updatePanelPosition, updatePanelSize]);

  // --- Drag logic (horizontal only) ---
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      focusPanel(entry.sessionId);
      dragRef.current = {
        startX: e.clientX,
        origX: panel.position.x,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [entry.sessionId, panel.position, focusPanel],
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const newX = dragRef.current.origX + dx;
      // Clamp: can't go past sidebar on left, can't push right edge past viewport
      const clampedX = Math.max(SIDEBAR_WIDTH, Math.min(newX, window.innerWidth - panel.size.width));
      updatePanelPosition(entry.sessionId, { x: clampedX });
    },
    [entry.sessionId, updatePanelPosition],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // --- Resize logic (top, left, right only — no bottom since anchored there) ---
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, edges: { top?: boolean; left?: boolean; right?: boolean }) => {
      e.preventDefault();
      e.stopPropagation();
      focusPanel(entry.sessionId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: panel.position.x,
        origW: panel.size.width,
        origH: panel.size.height,
        edges,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [entry.sessionId, panel.position, panel.size, focusPanel],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;

      let newW = r.origW;
      let newH = r.origH;
      let newX = r.origX;
      const maxH = window.innerHeight - BAR_HEIGHT;
      const maxW = window.innerWidth - SIDEBAR_WIDTH;

      if (r.edges.right) {
        newW = Math.min(Math.max(MIN_WIDTH, r.origW + dx), maxW);
      }
      if (r.edges.left) {
        const proposedW = Math.max(MIN_WIDTH, r.origW - dx);
        newW = Math.min(proposedW, maxW);
        if (newW > MIN_WIDTH && newW === proposedW) newX = r.origX + dx;
        // Don't go past sidebar
        if (newX < SIDEBAR_WIDTH) {
          newW = newW - (SIDEBAR_WIDTH - newX);
          newX = SIDEBAR_WIDTH;
        }
      }
      if (r.edges.top) {
        // Growing upward — clamp to viewport top
        newH = Math.min(Math.max(MIN_HEIGHT, r.origH - dy), maxH);
      }

      updatePanelSize(entry.sessionId, { width: newW, height: newH });
      updatePanelPosition(entry.sessionId, { x: newX });
    },
    [entry.sessionId, updatePanelSize, updatePanelPosition],
  );

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // --- Actions ---
  const handleRestart = async () => {
    await killTerminal(entry.sessionId);
    try {
      await startTerminal(entry.sessionId, entry.sessionName, entry.profile);
    } catch {
      // Error state handled by context
    }
  };

  const handleExpand = () => {
    togglePanel(entry.sessionId);
    router.push(`/sessions?select=${entry.sessionId}`);
  };

  const handlePopup = useCallback(() => {
    openTerminalPopup(entry.sessionId);
    togglePanel(entry.sessionId); // Close the floating panel
  }, [entry.sessionId, openTerminalPopup, togglePanel]);

  const handleMinimize = () => {
    togglePanel(entry.sessionId);
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await killTerminal(entry.sessionId);
  };

  const handlePanelClick = () => {
    focusPanel(entry.sessionId);
  };

  const statusColor =
    entry.status === 'running'
      ? 'bg-emerald-500'
      : entry.status === 'starting'
        ? 'bg-amber-500 animate-pulse'
        : 'bg-red-500';

  const isFocused = focusedPanelId === entry.sessionId;

  const resizeHandle = (
    cursor: string,
    edges: { top?: boolean; left?: boolean; right?: boolean },
    style: React.CSSProperties,
  ) => (
    <div
      style={{ position: 'absolute', ...style, cursor, zIndex: 10, touchAction: 'none' }}
      onPointerDown={(e) => handleResizeStart(e, edges)}
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
    />
  );

  return (
    <div
      ref={panelRef}
      onClick={handlePanelClick}
      className="fixed flex flex-col rounded-t-lg overflow-hidden shadow-2xl"
      style={{
        left: panel.position.x,
        bottom: BAR_HEIGHT,
        width: panel.size.width,
        height: panel.size.height,
        zIndex: panel.zIndex,
        border: `1px solid ${isFocused ? '#10b981' : '#3f3f46'}`,
        background: '#09090b',
      }}
    >
      {/* Resize handles — top edge (grow upward), left/right edges */}
      {resizeHandle('n-resize', { top: true }, { top: -3, left: 8, right: 8, height: 6 })}
      {resizeHandle('w-resize', { left: true }, { left: -3, top: 8, bottom: 8, width: 6 })}
      {resizeHandle('e-resize', { right: true }, { right: -3, top: 8, bottom: 8, width: 6 })}
      {/* Corner handles — top-left, top-right only */}
      {resizeHandle('nw-resize', { top: true, left: true }, { top: -3, left: -3, width: 12, height: 12 })}
      {resizeHandle('ne-resize', { top: true, right: true }, { top: -3, right: -3, width: 12, height: 12 })}

      {/* Header — horizontal drag only */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-800 select-none"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />
          <span className="text-xs text-zinc-200 truncate font-medium">{entry.sessionName}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleRestart}
            className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors rounded"
            title="Restart terminal"
          >
            <ArrowClockwise size={12} />
          </button>
          <button
            onClick={handlePopup}
            className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded"
            title="Open in popup window"
          >
            <Browser size={12} />
          </button>
          <button
            onClick={handleExpand}
            className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded"
            title="Open full view"
          >
            <ArrowsOut size={12} />
          </button>
          <button
            onClick={handleMinimize}
            className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded"
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={handleClose}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors rounded"
            title="Kill terminal"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {isRunning ? (
        <div ref={slotRef} className="flex-1 overflow-hidden" />
      ) : entry.status === 'starting' ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-zinc-500 animate-pulse">Starting...</p>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-red-400">Terminal error</p>
        </div>
      )}
    </div>
  );
}
