'use client';

import { useEffect, useRef } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  MatchDecorator,
} from '@codemirror/view';

const variableMatcher = new MatchDecorator({
  regexp: /\{\{(\w+)\}\}/g,
  decoration: () =>
    Decoration.mark({
      class: 'cm-variable-placeholder',
    }),
});

const variableHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = variableMatcher.createDeco(view);
    }
    update(update: any) {
      this.decorations = variableMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

interface MarkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  onViewReady?: (view: EditorView) => void;
}

export default function MarkdownEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Start writing...',
  readOnly = false,
  minHeight,
  onViewReady,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      markdown(),
      oneDark,
      variableHighlighter,
      cmPlaceholder(placeholder),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        blur: () => { onBlurRef.current?.(); },
      }),
      EditorView.theme({
        '&': {
          height: minHeight || '100%',
          fontSize: '14px',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-geist-mono), monospace',
        },
        '.cm-content': {
          padding: '12px 0',
        },
        '.cm-variable-placeholder': {
          color: '#10b981',
          fontWeight: '600',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderRadius: '3px',
          padding: '0 2px',
        },
      }),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    } else {
      extensions.push(
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        })
      );
    }

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    viewRef.current = view;
    onViewReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [readOnly]);

  // Update content when value changes externally (not from user typing)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="overflow-hidden h-full" style={minHeight ? { minHeight } : undefined} />;
}
