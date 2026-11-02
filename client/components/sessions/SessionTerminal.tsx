'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Play, Stop, ArrowClockwise, FolderOpen, ArrowSquareOut, Browser } from '@phosphor-icons/react';
import { useTerminals } from '@/lib/contexts/TerminalContext';

interface SessionTerminalProps {
  sessionId: string;
  sessionName: string;
  directory: string;
  profile: string;
  onRegisterInsert?: (insertFn: ((text: string) => void) | null) => void;
}

export default function SessionTerminal({
  sessionId,
  sessionName,
  directory,
  profile,
  onRegisterInsert,
}: SessionTerminalProps) {
  const { terminals, panels, popups, startTerminal, killTerminal, attachTerminal, detachTerminal, writeToTerminal, togglePanel, openTerminalPopup } = useTerminals();
  const slotRef = useRef<HTMLDivElement>(null);
  const entry = terminals.get(sessionId);
  const isRunning = entry?.status === 'running';
  const isStarting = entry?.status === 'starting';
  const hasTerminal = !!entry;
  const panelState = panels.get(sessionId)?.displayState;
  const isInPanel = panelState === 'popup';
  const isInPopup = popups.has(sessionId);

  // Attach/detach terminal div — skip when panel has it
  useEffect(() => {
    if (!isRunning || !slotRef.current || isInPanel || isInPopup) return;
    const container = slotRef.current;

    attachTerminal(sessionId, container);

    return () => {
      detachTerminal(sessionId, container);
    };
  }, [sessionId, isRunning, isInPanel, isInPopup, attachTerminal, detachTerminal]);

  // Register insert function
  useEffect(() => {
    if (isRunning) {
      onRegisterInsert?.((text: string) => {
        writeToTerminal(sessionId, text);
      });
    } else {
      onRegisterInsert?.(null);
    }

    return () => {
      onRegisterInsert?.(null);
    };
  }, [sessionId, isRunning, writeToTerminal, onRegisterInsert]);

  const handleStart = useCallback(async () => {
    try {
      await startTerminal(sessionId, sessionName, profile);
    } catch {
      // Error state handled by context
    }
  }, [sessionId, sessionName, profile, startTerminal]);

  const handleKill = useCallback(async () => {
    await killTerminal(sessionId);
  }, [sessionId, killTerminal]);

  const handleRestart = useCallback(async () => {
    await killTerminal(sessionId);
    try {
      await startTerminal(sessionId, sessionName, profile);
    } catch {
      // Error state handled by context
    }
  }, [sessionId, sessionName, profile, killTerminal, startTerminal]);

  // No terminal running — show idle state
  if (!hasTerminal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <FolderOpen size={24} className="text-zinc-600" />
        {directory ? (
          <>
            <p className="text-xs text-zinc-500 font-mono">{directory}</p>
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              <Play size={14} weight="fill" />
              Start Terminal
            </button>
          </>
        ) : (
          <p className="text-xs text-zinc-500">Set a directory to start a terminal</p>
        )}
      </div>
    );
  }

  // Starting state
  if (isStarting) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-zinc-500 animate-pulse">Starting terminal...</p>
      </div>
    );
  }

  // Error state
  if (entry?.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <p className="text-sm text-red-400">Failed to start terminal</p>
        <button
          onClick={handleStart}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Running — show toolbar + slot for portal
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/50 bg-zinc-950">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-zinc-600" />
          <span className="text-[11px] text-zinc-500">Terminal</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {isInPanel && (
            <span className="text-[10px] text-zinc-600 ml-1">in panel</span>
          )}
          {isInPopup && (
            <span className="text-[10px] text-zinc-600 ml-1">in popup</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isInPopup ? (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600">
              <Browser size={10} />
              In popup
            </span>
          ) : isInPanel ? (
            <button
              onClick={() => togglePanel(sessionId)}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-emerald-400 transition-colors"
            >
              <ArrowSquareOut size={10} />
              Show here
            </button>
          ) : (
            <>
              <button
                onClick={() => togglePanel(sessionId)}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ArrowSquareOut size={10} />
                Pop out
              </button>
              <button
                onClick={() => openTerminalPopup(sessionId)}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <Browser size={10} />
                Window
              </button>
            </>
          )}
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-emerald-400 transition-colors"
          >
            <ArrowClockwise size={10} />
            Restart
          </button>
          <button
            onClick={handleKill}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            <Stop size={10} weight="fill" />
            Kill
          </button>
        </div>
      </div>

      {isInPopup ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Browser size={20} className="text-zinc-700" />
          <p className="text-xs text-zinc-600">Terminal is running in a popup window</p>
        </div>
      ) : isInPanel ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <TerminalIcon size={20} className="text-zinc-700" />
          <p className="text-xs text-zinc-600">Terminal is running in floating panel</p>
          <button
            onClick={() => togglePanel(sessionId)}
            className="text-[11px] text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Show here instead
          </button>
        </div>
      ) : (
        <div ref={slotRef} className="flex-1 overflow-hidden" />
      )}
    </div>
  );
}
