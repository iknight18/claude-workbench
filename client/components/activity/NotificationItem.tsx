'use client';

import { Terminal, ClockClockwise, CheckCircle, X, Check } from '@phosphor-icons/react';
import type { Notification } from '@/lib/api/notifications';
import PreviewBox from './PreviewBox';
import { typeIcons, typeColors, urgencyBorder, timeAgo } from './shared';

interface NotificationItemProps {
  notification: Notification;
  isHovered: boolean;
  isFlashing: boolean;
  isSent: boolean;
  isPreviewExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDelete: () => void;
  onQuickReply: (reply: string) => void;
  onTogglePreview: () => void;
}

export default function NotificationItem({
  notification: n,
  isHovered,
  isFlashing,
  isSent,
  isPreviewExpanded,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDelete,
  onQuickReply,
  onTogglePreview,
}: NotificationItemProps) {
  // Standard variant
  const Icon = typeIcons[n.type] ?? CheckCircle;
  const color = typeColors[n.type] ?? 'text-zinc-400';
  const CategoryIcon = n.category === 'task' ? ClockClockwise : Terminal;
  const border = urgencyBorder[n.urgency] ?? urgencyBorder.info;
  const showQuickReply = n.source_id && (n.type === 'session_permission' || n.type === 'session_idle' || n.type === 'session_stopped');

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`flex items-start gap-2 px-3 py-2 border-l-2 ${border} border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors relative cursor-pointer ${isFlashing ? 'notification-new' : ''}`}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <Icon size={13} weight="fill" className={color} />
        <CategoryIcon size={7} weight="bold" className="absolute -bottom-0.5 -right-0.5 text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-200 truncate flex-1">{n.title}</p>
        </div>
        {n.message && (
          <p className="text-[10px] text-zinc-500 truncate font-mono">{n.message}</p>
        )}
        {n.preview && (
          <PreviewBox
            id={n.id}
            preview={n.preview}
            isExpanded={isPreviewExpanded}
            onToggle={onTogglePreview}
          />
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">{n.category}</span>
          <span className="text-[10px] text-zinc-500">{timeAgo(n.created_at)}</span>
          {showQuickReply && (
            <div className="ml-auto flex items-center gap-1">
              {isSent ? (
                <span className="text-[9px] text-emerald-500/70 flex items-center gap-0.5">
                  <Check size={9} /> Sent
                </span>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuickReply('ok'); }}
                    className="bg-emerald-500/15 text-emerald-400 text-xs px-2.5 py-1 rounded hover:bg-emerald-500/25 transition-colors"
                  >
                    ok
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onQuickReply('no'); }}
                    className="bg-zinc-700/50 text-zinc-400 text-xs px-2.5 py-1 rounded hover:bg-zinc-700/70 transition-colors"
                  >
                    no
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {isHovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
