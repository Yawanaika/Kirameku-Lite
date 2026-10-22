"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Thin controlled wrapper around CodeMirror 6 for the admin post editor.
 * The view is created once; external value changes (for example loading an
 * existing post) are dispatched into the document without recreating it.
 */
export default function MarkdownEditor({
  id,
  value,
  onChange,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValue = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const state = EditorState.create({
      doc: initialValue.current,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.contentAttributes.of({
          ...(id ? { id } : {}),
          "aria-label": "文章正文",
          spellcheck: "false",
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": {
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            lineHeight: "1.65",
          },
          ".cm-content": { padding: "12px 0" },
          "&.cm-focused": { outline: "none" },
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] overflow-hidden rounded-xl border border-white/10"
    />
  );
}
