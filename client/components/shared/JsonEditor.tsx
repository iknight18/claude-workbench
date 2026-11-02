'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';

const jsonLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc.toString();
  if (!doc.trim()) return diagnostics;

  try {
    JSON.parse(doc);
  } catch (e: any) {
    const msg = e.message as string;
    // Try to extract position from "at position N" in error message
    const posMatch = msg.match(/position\s+(\d+)/);
    const pos = posMatch ? Math.min(Number(posMatch[1]), doc.length) : 0;

    diagnostics.push({
      from: pos,
      to: Math.min(pos + 1, doc.length),
      severity: 'error',
      message: msg.replace(/^JSON\.parse:\s*/, ''),
    });
  }

  return diagnostics;
});

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
}

export default function JsonEditor({
  value,
  onChange,
  placeholder = '{}',
  readOnly = false,
  minHeight = '256px',
}: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      json(),
      jsonLinter,
      lintGutter(),
      oneDark,
      cmPlaceholder(placeholder),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          height: '100%',
          minHeight,
          fontSize: '12px',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-geist-mono), monospace',
        },
        '.cm-content': {
          padding: '8px 0',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          borderRight: '1px solid #27272a',
        },
        '.cm-lint-marker-error': {
          content: '"!"',
        },
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    } else {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        })
      );
    }

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [readOnly]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  const handleFormat = useCallback(() => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const doc = view.state.doc.toString();
    try {
      const formatted = JSON.stringify(JSON.parse(doc), null, 2);
      if (formatted !== doc) {
        view.dispatch({
          changes: { from: 0, to: doc.length, insert: formatted },
        });
        onChangeRef.current?.(formatted);
      }
    } catch {
      // Invalid JSON — can't format
    }
  }, [readOnly]);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={containerRef}
        className="overflow-hidden rounded border border-zinc-800 bg-zinc-900"
        style={{ minHeight }}
      />
      {!readOnly && (
        <button
          type="button"
          onClick={handleFormat}
          className="self-start text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Format JSON
        </button>
      )}
    </div>
  );
}
