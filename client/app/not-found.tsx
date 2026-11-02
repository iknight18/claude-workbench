import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-center px-8 select-none">
      <div className="mb-6 font-mono text-7xl font-bold text-zinc-800 tracking-tighter">404</div>
      <h1 className="text-base font-medium text-zinc-300 mb-2 tracking-tight">Page not found</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-[36ch] leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-all"
      >
        Go home
      </Link>
    </div>
  );
}
