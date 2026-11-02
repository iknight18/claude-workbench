import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { TerminalProvider } from '@/lib/contexts/TerminalContext';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <TerminalProvider>
        <div className="h-screen overflow-hidden">
          {children}
        </div>
      </TerminalProvider>
    </NotificationProvider>
  );
}
