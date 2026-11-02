'use client';

import { useEffect } from 'react';
import { ArrowCounterClockwise, Warning } from '@phosphor-icons/react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-center px-8 select-none">
      <div className="mb-5 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
        <Warning size={32} weight="light" />
      </div>
      <h1 className="text-base font-medium text-zinc-300 mb-2 tracking-tight">Something went wrong</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-[40ch] leading-relaxed">
        {error.message || 'An unexpected error occurred. You can try again or reload the page.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all cursor-pointer"
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all"
        >
          Go home
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-zinc-700 font-mono">digest: {error.digest}</p>
      )}
    </div>
  );
}
