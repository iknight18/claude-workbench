'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowUp, Trash } from '@phosphor-icons/react';
import type { Notification } from '@/lib/api/notifications';
import { sendTerminalInput } from '@/lib/api/notifications';
import NotificationItem from './NotificationItem';
import { FILTER_OPTIONS, FILTER_TYPE_MAP, type NotificationFilter } from './shared';

interface NotificationFeedProps {
  notifications: Notification[];
  flashIds: Set<string>;
  showScrollPill: boolean;
  onDismissFlash: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onScrollStateChange: (atTop: boolean) => void;
  onScrollToTop: () => void;
  logRef: React.RefObject<HTMLDivElement | null>;
}

export default function NotificationFeed({
  notifications,
  flashIds,
  showScrollPill,
  onDismissFlash,
  onDelete,
  onClearAll,
  onScrollStateChange,
  onScrollToTop,
  logRef,
}: NotificationFeedProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const handleScroll = useCallback(() => {
    if (!logRef.current) return;
    onScrollStateChange(logRef.current.scrollTop < 50);
  }, [logRef, onScrollStateChange]);

  const handleQuickReply = useCallback(async (notificationId: string, sessionId: string, reply: string) => {
    if (!sessionId || sentIds.has(notificationId)) return;
    try {
      await sendTerminalInput(sessionId, reply);
      setSentIds((prev) => new Set(prev).add(notificationId));
    } catch {}
  }, [sentIds]);

  // Filter: exclude session_task (shown in tracker), then apply type filter
  const logNotifications = notifications.filter((n) => {
    if (n.category === 'session_task') return false;
    if (activeFilter === 'all') return true;
    return FILTER_TYPE_MAP[activeFilter].includes(n.type);
  });

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800 flex-shrink-0 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              activeFilter === opt.value
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Scrollable log */}
      <div className="flex-1 relative overflow-hidden">
        {showScrollPill && (
          <button
            onClick={onScrollToTop}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium rounded-full border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            <ArrowUp size={10} />
            New notifications
          </button>
        )}

        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
        >
          {logNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs text-zinc-500">
                {activeFilter === 'all' ? 'No notifications yet' : 'No matching notifications'}
              </span>
            </div>
          ) : (
            logNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                isHovered={hoveredId === n.id}
                isFlashing={flashIds.has(n.id)}
                isSent={sentIds.has(n.id)}
                isPreviewExpanded={expandedPreviews.has(n.id)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onDismissFlash(n.id)}
                onDelete={() => onDelete(n.id)}
                onQuickReply={(reply) => handleQuickReply(n.id, n.source_id, reply)}
                onTogglePreview={() => setExpandedPreviews((prev) => {
                  const next = new Set(prev);
                  if (next.has(n.id)) next.delete(n.id);
                  else next.add(n.id);
                  return next;
                })}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      {logNotifications.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-center px-3 py-1.5 border-t border-zinc-800">
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash size={10} />
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
