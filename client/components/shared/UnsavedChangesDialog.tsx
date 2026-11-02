'use client';

import { useEffect, useRef } from 'react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedChangesDialog({
  open,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Tab') {
        const focusable = document.querySelectorAll<HTMLElement>(
          '[data-unsaved-dialog] button'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-desc"
        data-unsaved-dialog
        className="relative bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 max-w-[calc(100vw-2rem)] shadow-xl"
      >
        <h3 id="unsaved-dialog-title" className="text-sm font-medium text-zinc-200 tracking-tight">
          Unsaved changes
        </h3>
        <p id="unsaved-dialog-desc" className="text-xs text-zinc-500 mt-2">
          You have unsaved changes. Do you want to discard them?
        </p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-md hover:bg-red-500/20 transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
