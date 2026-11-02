'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Microphone, PaperPlaneTilt, X } from '@phosphor-icons/react';

interface VoiceInputProps {
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function VoiceInput({ onSend, onClose }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. HTTPS required for LAN access.');
      } else {
        setError(`Speech error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setError(null);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // Auto-start listening when component mounts
  useEffect(() => {
    startListening();
    return () => {
      recognitionRef.current?.stop();
    };
  }, [startListening]);

  const handleSend = () => {
    if (transcript.trim()) {
      onSend(transcript.trim());
      setTranscript('');
      onClose();
    }
  };

  return (
    <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
      {error ? (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-red-400">{error}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={listening ? stopListening : startListening}
            className={`p-1.5 rounded-full transition-colors ${
              listening
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Microphone size={14} />
          </button>

          <div className="flex-1 min-w-0">
            {listening && !transcript && (
              <span className="text-[11px] text-zinc-500 italic">Listening...</span>
            )}
            {transcript && (
              <input
                type="text"
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                className="w-full bg-transparent text-[11px] text-zinc-300 outline-none"
                autoFocus
              />
            )}
          </div>

          {transcript && (
            <button
              onClick={handleSend}
              className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            >
              <PaperPlaneTilt size={12} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
