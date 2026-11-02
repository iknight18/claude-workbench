'use client';

import { useState } from 'react';
import { Microphone, Keyboard } from '@phosphor-icons/react';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import VoiceInput from './VoiceInput';
import KeyboardInput from './KeyboardInput';

interface QuickActionBarProps {
  sessionId: string;
  hasPermissionPrompt?: boolean;
}

export default function QuickActionBar({ sessionId, hasPermissionPrompt = false }: QuickActionBarProps) {
  const { writeToTerminal } = useTerminals();
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const sendText = (text: string) => {
    writeToTerminal(sessionId, text + '\r');
  };

  const sendInterrupt = () => {
    writeToTerminal(sessionId, '\x03');
  };

  return (
    <div className="flex-shrink-0 border-t border-zinc-800">
      {/* Voice/Keyboard input area */}
      {showVoice && (
        <VoiceInput
          onSend={sendText}
          onClose={() => setShowVoice(false)}
        />
      )}
      {showKeyboard && (
        <KeyboardInput
          onSend={sendText}
          onClose={() => setShowKeyboard(false)}
        />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button
          onClick={() => sendText('yes')}
          className={`px-3 py-2 min-h-[44px] rounded-md text-xs font-medium transition-colors ${
            hasPermissionPrompt
              ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          } active:bg-emerald-500/30`}
        >
          Yes
        </button>
        <button
          onClick={() => sendText('no')}
          className={`px-3 py-2 min-h-[44px] rounded-md text-xs font-medium transition-colors ${
            hasPermissionPrompt
              ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/40'
              : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
          } active:bg-red-500/30`}
        >
          No
        </button>
        <button
          onClick={() => sendText('approve')}
          className={`px-3 py-2 min-h-[44px] rounded-md text-xs transition-colors ${
            hasPermissionPrompt
              ? 'bg-zinc-700 text-zinc-200 ring-1 ring-zinc-500/40'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          } active:bg-zinc-600`}
        >
          Approve
        </button>
        <button
          onClick={() => sendText('deny')}
          className={`px-3 py-2 min-h-[44px] rounded-md text-xs transition-colors ${
            hasPermissionPrompt
              ? 'bg-zinc-700 text-zinc-200 ring-1 ring-zinc-500/40'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          } active:bg-zinc-600`}
        >
          Deny
        </button>
        <button
          onClick={sendInterrupt}
          className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
        >
          Stop
        </button>

        <div className="flex-1" />

        <button
          onClick={() => { setShowVoice(v => !v); setShowKeyboard(false); }}
          className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors ${
            showVoice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          <Microphone size={16} />
        </button>
        <button
          onClick={() => { setShowKeyboard(k => !k); setShowVoice(false); }}
          className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors ${
            showKeyboard ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          <Keyboard size={16} />
        </button>
      </div>
    </div>
  );
}
