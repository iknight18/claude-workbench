import { Suspense } from 'react';
import Sidebar from '@/components/shell/Sidebar';
import { NavigationGuardProvider } from '@/lib/contexts/NavigationGuardContext';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { TerminalProvider } from '@/lib/contexts/TerminalContext';
import TerminalBar from '@/components/shell/TerminalBar';
import TerminalPanelLayer from '@/components/shell/TerminalPanelLayer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationGuardProvider>
      <NotificationProvider>
        <TerminalProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <main className="flex-1 overflow-hidden">{children}</main>
              <TerminalPanelLayer />
              <Suspense><TerminalBar /></Suspense>
            </div>
          </div>
        </TerminalProvider>
      </NotificationProvider>
    </NavigationGuardProvider>
  );
}
