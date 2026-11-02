import { type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    shortcut?: string;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 select-none">
      {icon && (
        <div className="mb-5 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-300 mb-2 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 mb-6 max-w-[36ch] leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all cursor-pointer"
        >
          <Plus size={14} weight="bold" />
          {action.label}
          {action.shortcut && (
            <kbd className="ml-1 text-xs text-emerald-500/50 font-mono">{action.shortcut}</kbd>
          )}
        </button>
      )}
    </div>
  );
}
