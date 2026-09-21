"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { countWords, htmlToPlainText, estimateReadingTimeMinutes } from "@contenthub/shared";

export interface EditorStats {
  html: string;
  wordCount: number;
  readingTimeMinutes: number;
}

interface EditorProps {
  initialHtml?: string;
  onChange: (stats: EditorStats) => void;
}

/**
 * Creator Studio chapter editor (docs/ARCHITECTURE.md #6): Bold/Italic/
 * Heading/Paragraph/Quote/List/Ordered list/Link/Image/Divider via TipTap's
 * StarterKit + Link/Image extensions. Word count and reading time are
 * derived on every change and handed to the caller, which owns autosave.
 */
export function Editor({ initialHtml, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image],
    content: initialHtml ?? "<p></p>",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const wordCount = countWords(htmlToPlainText(html));
      onChange({ html, wordCount, readingTimeMinutes: estimateReadingTimeMinutes(wordCount) });
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} aria-pressed={editor.isActive("bold")}>
          Bold
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} aria-pressed={editor.isActive("italic")}>
          Italic
        </button>
        <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} aria-pressed={editor.isActive("paragraph")}>
          Paragraph
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-pressed={editor.isActive("heading", { level: 2 })}>
          Heading
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-pressed={editor.isActive("blockquote")}>
          Quote
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} aria-pressed={editor.isActive("bulletList")}>
          List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-pressed={editor.isActive("orderedList")}>
          Ordered list
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Image URL");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
        >
          Image
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          Divider
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
