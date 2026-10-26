"use client";

import { Extension, Mark, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Superscript from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@/lib/model";
import { uid } from "@/lib/model";

const SuggestionInsert = Mark.create({
  name: "suggestionInsert",
  parseHTML: () => [{ tag: "ins" }],
  renderHTML: () => ["ins", { class: "suggestion-insert" }, 0],
});

const SuggestionDelete = Mark.create({
  name: "suggestionDelete",
  parseHTML: () => [{ tag: "del" }],
  renderHTML: () => ["del", { class: "suggestion-delete" }, 0],
});

const Suggesting = Extension.create({
  name: "suggesting",
  addStorage() {
    return { enabled: false };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (!storage.enabled) return false;
            const mark = view.state.schema.marks.suggestionInsert;
            if (!mark) return false;
            const tr = view.state.tr.insertText(text, from, to);
            tr.addMark(from, Math.min(from + text.length, tr.doc.content.size), mark.create());
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "hr[data-scene]" }],
  renderHTML: () => ["hr", { "data-scene": "1" }],
});

const Footnote = Node.create({
  name: "footnote",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      text: { default: "" },
    };
  },
  parseHTML: () => [{ tag: "sup[data-footnote]" }],
  renderHTML({ HTMLAttributes }) {
    return ["sup", { "data-footnote": HTMLAttributes.text, title: HTMLAttributes.text }, "*"];
  },
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        renderHTML: (attributes) => ({ style: `width: ${attributes.width}` }),
      },
    };
  },
});

async function storeImage(file: File) {
  if (file.size <= 4_000_000) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body });
    if (response.ok) {
      const payload = await response.json();
      if (payload.url) return payload.url as string;
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  return dataUrl;
}

export function ManuscriptEditor({
  nodeId,
  content,
  readOnly,
  onChange,
}: {
  nodeId: string;
  content: JSONContent;
  readOnly: boolean;
  onChange: (doc: JSONContent) => void;
}) {
  const [suggest, setSuggest] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const seeded = useRef(content);
  const seenNode = useRef(nodeId);
  const applying = useRef(false);
  onChangeRef.current = onChange;

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      Superscript,
      Placeholder.configure({ placeholder: "Start the page…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableImage,
      SceneBreak,
      Footnote,
      SuggestionInsert,
      SuggestionDelete,
      Suggesting,
    ],
    [],
  );
  const editorProps = useMemo(() => ({ attributes: { spellcheck: "true" } }), []);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions,
    content: seeded.current,
    editorProps,
    onUpdate: ({ editor: instance }) => {
      if (applying.current) return;
      onChangeRef.current(instance.getJSON());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === readOnly) editor.setEditable(!readOnly);
    const storage = editor.storage as { suggesting?: { enabled: boolean } };
    if (storage.suggesting && storage.suggesting.enabled !== suggest) storage.suggesting.enabled = suggest;
    if (seenNode.current === nodeId) return;
    seenNode.current = nodeId;
    applying.current = true;
    editor.commands.setContent(content, { emitUpdate: false });
    queueMicrotask(() => {
      applying.current = false;
    });
  }, [editor, nodeId, content, readOnly, suggest]);

  if (!editor) return <div className="h-[70vh] animate-pulse rounded-lg bg-paper" />;

  const tool = (label: string, action: () => void, active = false) => (
    <button
      type="button"
      className={`rounded px-2 py-1 text-sm ${active ? "bg-accent text-[var(--accent-ink)]" : "hover:bg-sidebar"}`}
      onClick={action}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-line pb-2">
        {tool("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {tool("Italic", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {tool("Underline", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {tool("Heading", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
        {tool("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {tool("List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {tool("Numbered", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {tool("Table", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        {tool("Row", () => editor.chain().focus().addRowAfter().run())}
        {tool("Column", () => editor.chain().focus().addColumnAfter().run())}
        {tool("Scene", () => editor.chain().focus().insertContent({ type: "sceneBreak" }).run())}
        {tool("Note", () => {
          const text = window.prompt("Footnote text");
          if (!text) return;
          editor.chain().focus().insertContent({ type: "footnote", attrs: { id: uid(), text } }).run();
        })}
        {tool("Image", () => fileRef.current?.click())}
        {tool(suggest ? "Suggesting" : "Suggest", () => setSuggest((value) => !value), suggest)}
        {tool("Mark delete", () => editor.chain().focus().setMark("suggestionDelete").run())}
        {tool("Accept", () => editor.chain().focus().unsetMark("suggestionInsert").unsetMark("suggestionDelete").run())}
        {tool("40%", () => editor.chain().focus().updateAttributes("image", { width: "40%" }).run())}
        {tool("70%", () => editor.chain().focus().updateAttributes("image", { width: "70%" }).run())}
        {tool("Full", () => editor.chain().focus().updateAttributes("image", { width: "100%" }).run())}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <input className="rounded border border-line bg-paper-2 px-2 py-1" placeholder="Find" value={find} onChange={(event) => setFind(event.target.value)} />
        <input className="rounded border border-line bg-paper-2 px-2 py-1" placeholder="Replace" value={replace} onChange={(event) => setReplace(event.target.value)} />
        <button
          type="button"
          className="rounded border border-line px-2 py-1"
          onClick={() => {
            if (!find) return;
            const text = editor.getText();
            if (!text.includes(find)) return;
            const html = editor.getHTML().replace(find, replace);
            editor.commands.setContent(html);
          }}
        >
          Replace
        </button>
        <button
          type="button"
          className="rounded border border-line px-2 py-1"
          onClick={() => {
            if (!find) return;
            editor.commands.setContent(editor.getHTML().split(find).join(replace));
          }}
        >
          Replace all
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const src = await storeImage(file);
          editor.chain().focus().setImage({ src, alt: file.name }).run();
        }}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
