'use client';

import { useEffect } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-zinc-950 text-zinc-300 antialiased">
        <div className="flex flex-col items-center justify-center h-screen text-center px-8 select-none">
          <div className="mb-4 font-mono text-5xl font-bold text-zinc-800 tracking-tighter">500</div>
          <h1 className="text-base font-medium text-zinc-300 mb-2 tracking-tight">Critical error</h1>
          <p className="text-sm text-zinc-500 mb-8 max-w-[40ch] leading-relaxed">
            The application encountered a fatal error. Please try reloading.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all cursor-pointer"
            >
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
      </body>
    </html>
  );
}
