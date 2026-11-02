import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terminal',
};

export default function TerminalPopupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-[#0a0a0b] text-zinc-100 overflow-hidden">
      {children}
    </div>
  );
}
