import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activity Center',
};

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {children}
    </div>
  );
}
