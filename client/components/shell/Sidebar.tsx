'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House,
  Lightning,
  Terminal,
  ClockClockwise,
  Gear,
  Bell,
} from '@phosphor-icons/react';
import { useNavigationGuard } from '@/lib/contexts/NavigationGuardContext';
import UnsavedChangesDialog from '@/components/shared/UnsavedChangesDialog';
import { useNotifications } from '@/lib/contexts/NotificationContext';

const navItems = [
  { href: '/', icon: House, label: 'Home' },
  { href: '/prompts', icon: Lightning, label: 'Prompts' },
  { href: '/sessions', icon: Terminal, label: 'Sessions' },
  { href: '/schedules', icon: ClockClockwise, label: 'Schedules' },
];

const bottomItems = [
  { href: '/settings', icon: Gear, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { shouldBlock } = useNavigationGuard();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { unreadCount, openActivityWindow } = useNotifications();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleNavigate = useCallback(
    (href: string, e: { preventDefault: () => void }) => {
      if (href !== pathname && shouldBlock()) {
        e.preventDefault();
        setPendingHref(href);
      }
    },
    [shouldBlock, pathname]
  );

  const handleDiscard = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }, [pendingHref, router]);

  const handleCancel = useCallback(() => {
    setPendingHref(null);
  }, []);

  const renderLink = ({ href, icon: Icon, label }: typeof navItems[number]) => (
    <Link
      key={href}
      href={href}
      title={label}
      aria-label={label}
      aria-current={isActive(href) ? 'page' : undefined}
      onNavigate={(e) => handleNavigate(href, e)}
      className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
        isActive(href)
          ? 'bg-zinc-800 text-emerald-500'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      }`}
    >
      <Icon size={20} weight={isActive(href) ? 'fill' : 'regular'} />
    </Link>
  );

  return (
    <>
      <aside className="flex flex-col items-center w-12 h-screen bg-zinc-900 border-r border-zinc-800 py-3 flex-shrink-0">
        <nav aria-label="Main navigation" className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(renderLink)}
        </nav>
        <div className="flex flex-col items-center gap-1">
          {/* Notification bell — opens activity window */}
          <button
            title="Activity Center"
            aria-label={unreadCount > 0 ? `Activity Center, ${unreadCount} unread` : 'Activity Center'}
            onClick={openActivityWindow}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors relative text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          >
            <Bell size={20} weight="regular" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-emerald-500 text-zinc-950 text-[9px] font-bold rounded-full px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {bottomItems.map(renderLink)}
        </div>
      </aside>

      <UnsavedChangesDialog
        open={pendingHref !== null}
        onDiscard={handleDiscard}
        onCancel={handleCancel}
      />
    </>
  );
}
