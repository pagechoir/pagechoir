"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { insertEditorImage, ManuscriptEditor } from "@/components/editor";
import { useBook } from "@/components/book-provider";
import { writingIssues } from "@/lib/stats";
import {
  canComment,
  canWrite,
  childrenOf,
  emptyDoc,
  now,
  plainTextFromDoc,
  tombstone,
  uid,
  wordCountText,
  type DocNode,
  type JSONContent,
} from "@/lib/model";

type Tool = "format" | "find" | "spelling" | "comments" | "notes" | "split" | "delete";
type Bucket = "front" | "body" | "back";

export function Manuscript() {
  const { bundle, update, role, lastOpenedAt, markCaughtUp, status, savedAt, syncedAt, wordCount } = useBook();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [organize, setOrganize] = useState<Bucket | null>(null);
  const [closed, setClosed] = useState<Record<Bucket, boolean>>({ front: false, body: false, back: false });
  const [treeOpen, setTreeOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [findNote, setFindNote] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [, redraw] = useState(0);
  const dragId = useRef<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;
    const bump = () => redraw((value) => value + 1);
    editor.on("transaction", bump);
    return () => {
      editor.off("transaction", bump);
    };
  }, [editor]);

  if (!bundle) return null;
  const active = bundle.nodes.find((node) => node.id === activeId) ?? bundle.nodes.find((node) => node.kind === "chapter") ?? bundle.nodes[0];
  const text = plainTextFromDoc(active?.content);
  const issues = writingIssues(text);
  const changed = bundle.nodes.filter((node) => lastOpenedAt && node.updatedAt > lastOpenedAt);
  const pins = bundle.pins.filter((pin) => pin.nodeId === active?.id || bundle.nodes.some((node) => node.id === pin.nodeId && node.parentId === active?.id));
  const editable = canWrite(role) && active?.matterKey !== "title";
  const front = childrenOf(bundle.nodes, null).filter((node) => node.kind === "front");
  const back = childrenOf(bundle.nodes, null).filter((node) => node.kind === "back");
  const body = childrenOf(bundle.nodes, null).filter((node) => node.kind === "part" || node.kind === "chapter");
  const sequence = readingOrder(bundle.nodes);
  const index = sequence.findIndex((node) => node.id === active?.id);
  const chapterNumber = active ? chapterIndex(bundle.nodes, active.id) : 0;
  const statusLine = status === "synced"
    ? `Synced ${syncedAt ? new Date(syncedAt).toLocaleTimeString() : ""}`.trim()
    : status === "offline"
      ? "Saved locally. Sync is waiting."
      : `Saved locally ${savedAt ? new Date(savedAt).toLocaleTimeString() : ""}`.trim();

  function patchNode(id: string, patch: Partial<DocNode>) {
    update((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch, updatedAt: now() } : node)),
    }));
  }

  function addNode(kind: DocNode["kind"], parentId: string | null) {
    const siblings = childrenOf(bundle!.nodes, parentId).filter((node) => parentId || sameBucket(node, kind));
    const created: DocNode = {
      id: uid(),
      parentId,
      kind,
      matterKey: "",
      title: kind === "part" ? "Part" : kind === "scene" ? "Scene" : kind === "front" ? "Front matter" : kind === "back" ? "Back matter" : "Chapter",
      included: true,
      order: siblings.length ? Math.max(...siblings.map((node) => node.order)) + 1 : 1,
      content: emptyDoc(),
      updatedAt: now(),
    };
    update((current) => ({ ...current, nodes: [...current.nodes, created] }));
    setActiveId(created.id);
    setAddOpen(false);
    setTreeOpen(false);
  }

  function relocate(sourceId: string, parentId: string | null, kind: DocNode["kind"], beforeId: string | null) {
    update((current) => {
      const source = current.nodes.find((node) => node.id === sourceId);
      if (!source || source.id === beforeId) return current;
      if (parentId && contains(current.nodes, sourceId, parentId)) return current;
      const moved = current.nodes.map((node) => (node.id === sourceId ? { ...node, parentId, kind, updatedAt: now() } : node));
      const bucket = moved
        .filter((node) => inBucket(node, parentId, kind))
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      const without = bucket.filter((node) => node.id !== sourceId);
      const inserted = moved.find((node) => node.id === sourceId);
      if (!inserted) return current;
      const at = beforeId ? without.findIndex((node) => node.id === beforeId) : without.length;
      without.splice(at < 0 ? without.length : at, 0, inserted);
      const orders = new Map(without.map((node, order) => [node.id, order]));
      return {
        ...current,
        nodes: moved.map((node) => (orders.has(node.id) ? { ...node, order: orders.get(node.id) ?? node.order } : node)),
      };
    });
  }

  function dropOn(target: DocNode) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === target.id) return;
    const source = bundle!.nodes.find((node) => node.id === sourceId);
    if (!source) return;
    if (target.kind === "part") {
      relocate(sourceId, target.id, source.kind === "part" ? "chapter" : source.kind === "front" || source.kind === "back" ? "chapter" : source.kind, null);
      return;
    }
    if (target.kind === "scene") {
      relocate(sourceId, target.parentId, "scene", target.id);
      return;
    }
    if (target.kind === "front" || target.kind === "back") {
      relocate(sourceId, null, target.kind, target.id);
      return;
    }
    relocate(sourceId, target.parentId, source.kind === "part" ? "part" : source.kind === "scene" ? "scene" : "chapter", target.id);
  }

  function dropIn(bucket: Bucket) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId) return;
    const source = bundle!.nodes.find((node) => node.id === sourceId);
    if (!source) return;
    const kind = bucket === "front" ? "front" : bucket === "back" ? "back" : source.kind === "part" ? "part" : "chapter";
    relocate(sourceId, null, kind, null);
  }

  function removeActive() {
    if (!active || active.kind === "front" && active.matterKey === "title") return;
    const neighbor = sequence[index - 1] ?? sequence[index + 1];
    update((current) => {
      const next = { ...current, nodes: current.nodes.filter((node) => node.id !== active.id && node.parentId !== active.id) };
      tombstone(next, "node", active.id);
      for (const child of current.nodes.filter((node) => node.parentId === active.id)) tombstone(next, "node", child.id);
      return next;
    });
    setActiveId(neighbor?.id ?? null);
    setConfirmDelete(false);
    setTool(null);
  }

  function splitActive() {
    if (!editor || !active || active.matterKey === "title") return;
    const doc = editor.state.doc;
    const at = chooseSplit(doc, editor.state.selection.from);
    if (at == null) return;
    const left = doc.cut(0, at).toJSON() as JSONContent;
    const right = doc.cut(at).toJSON() as JSONContent;
    const created: DocNode = {
      id: uid(),
      parentId: active.parentId,
      kind: active.kind === "scene" ? "scene" : active.kind === "part" ? "chapter" : active.kind,
      matterKey: "",
      title: `${active.title} continued`,
      included: true,
      order: active.order + 0.5,
      content: right,
      updatedAt: now(),
    };
    update((current) => {
      const nodes = current.nodes.map((node) => (node.id === active.id ? { ...node, content: left, updatedAt: now() } : node));
      nodes.push(created);
      const bucket = nodes
        .filter((node) => inBucket(node, created.parentId, created.kind))
        .sort((a, b) => a.order - b.order);
      const orders = new Map(bucket.map((node, order) => [node.id, order]));
      return { ...current, nodes: nodes.map((node) => (orders.has(node.id) ? { ...node, order: orders.get(node.id) ?? node.order } : node)) };
    });
    setActiveId(created.id);
    setTool(null);
  }

  function toggleTool(next: Tool) {
    setConfirmDelete(false);
    setTool((current) => (current === next ? null : next));
  }

  let bodyNumber = 0;
  const row = (node: DocNode, depth = 0) => {
    const number = node.kind === "chapter" ? ++bodyNumber : null;
    return (
    <li key={node.id}>
      <div
        className={`studio-row ${node.id === active?.id ? "is-active" : ""} ${node.included ? "" : "is-hidden"}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dropOn(node);
        }}
      >
        <button type="button" className="studio-row-button" onClick={() => { setActiveId(node.id); setTreeOpen(false); }}>
          {number ? <span className="studio-num">{number}</span> : <span className="studio-num" />}
          <span className="truncate">{node.title || "Untitled"}</span>
          {changed.some((item) => item.id === node.id) ? <span className="studio-dot" aria-label="Changed" /> : null}
        </button>
        {canWrite(role) ? (
          <span
            className="studio-grip"
            draggable
            aria-label={`Drag ${node.title || "section"}`}
            onDragStart={(event) => {
              dragId.current = node.id;
              event.dataTransfer.setData("text/plain", node.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              dragId.current = null;
            }}
          >
            <GripIcon />
          </span>
        ) : null}
      </div>
      {organize && sameBucket(node, organize === "body" ? "chapter" : organize) ? (
        <label className="studio-include">
          <input type="checkbox" checked={node.included} onChange={(event) => patchNode(node.id, { included: event.target.checked })} />
          Include
        </label>
      ) : null}
      {node.kind === "chapter" || node.kind === "part" ? (
        <ol>
          {childrenOf(bundle.nodes, node.id).map((child) => row(child, depth + 1))}
        </ol>
      ) : null}
    </li>
    );
  };

  return (
    <div className={`studio-write ${focus ? "is-focus" : ""}`} style={{ ["--scene-break" as string]: JSON.stringify(bundle.book.settings.sceneBreak || "✶") }}>
      <aside className={`studio-tree ${treeOpen ? "is-open" : ""}`}>
        <header className="studio-tree-head">
          <strong>Manuscript</strong>
          {canWrite(role) ? (
            <div className="relative">
              <button type="button" className="studio-add" onClick={() => setAddOpen((open) => !open)}>Add <span aria-hidden="true">+</span></button>
              {addOpen ? (
                <div className="studio-menu">
                  <button type="button" onClick={() => addNode("chapter", active?.kind === "part" ? active.id : null)}>Chapter</button>
                  <button type="button" onClick={() => active?.kind === "chapter" && addNode("scene", active.id)}>Scene</button>
                  <button type="button" onClick={() => addNode("part", null)}>Part</button>
                  <button type="button" onClick={() => addNode("front", null)}>Front matter page</button>
                  <button type="button" onClick={() => addNode("back", null)}>Back matter page</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>
        {changed.length ? (
          <p className="studio-changed">
            {changed.length} changed
            <button type="button" onClick={() => void markCaughtUp()}>Mark caught up</button>
          </p>
        ) : null}
        <div className="studio-tree-scroll">
          <Section
            title="Front matter"
            closed={closed.front}
            onToggle={() => setClosed((value) => ({ ...value, front: !value.front }))}
            onEdit={() => setOrganize((value) => (value === "front" ? null : "front"))}
            editing={organize === "front"}
          >
            <ol>{front.map((node) => row(node))}</ol>
            <DropHint label="Drag chapters here" onDrop={() => dropIn("front")} />
          </Section>
          <Section
            title="Body"
            closed={closed.body}
            onToggle={() => setClosed((value) => ({ ...value, body: !value.body }))}
            onEdit={() => setOrganize((value) => (value === "body" ? null : "body"))}
            editing={organize === "body"}
          >
            <ol>{body.map((node) => row(node))}</ol>
            <DropHint label={body.length === 0 ? "Drag chapters here" : ""} onDrop={() => dropIn("body")} />
          </Section>
          <Section
            title="Back matter"
            closed={closed.back}
            onToggle={() => setClosed((value) => ({ ...value, back: !value.back }))}
            onEdit={() => setOrganize((value) => (value === "back" ? null : "back"))}
            editing={organize === "back"}
          >
            <ol>{back.map((node) => row(node))}</ol>
            <DropHint label="Drag chapters here" onDrop={() => dropIn("back")} />
          </Section>
        </div>
        <footer className="studio-words">{wordCount.toLocaleString()} words</footer>
      </aside>

      <section className="studio-page">
        <header className="studio-page-bar">
          <button type="button" className="studio-tree-toggle" onClick={() => setTreeOpen((open) => !open)} aria-label="Manuscript">☰</button>
          <Link href="/" className="studio-back" aria-label="Bookshelf">←</Link>
          <div className="studio-titleblock">
            <strong>{bundle.book.title}</strong>
            <span>{statusLine}</span>
          </div>
          <Link href={`/books/${bundle.book.id}/goals`} className="studio-goals">Goals & insights</Link>
        </header>
        {focus ? <button type="button" className="studio-leave" onClick={() => setFocus(false)}>Leave focus</button> : null}
        <div className="studio-sheet prose-page">
          <div className="studio-column">
            {active?.matterKey === "title" ? (
              <div className="studio-titlepage">
                <input value={bundle.book.title} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, title: event.target.value, updatedAt: now() } }))} />
                <input placeholder="Subtitle" value={bundle.book.subtitle} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, subtitle: event.target.value, updatedAt: now() } }))} />
                <input value={bundle.book.authorName} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, authorName: event.target.value, updatedAt: now() } }))} />
              </div>
            ) : active ? (
              <>
                {chapterNumber ? <p className="studio-chapternum">{chapterNumber}</p> : null}
                <input
                  className="studio-chapter-title"
                  value={active.title}
                  readOnly={!canWrite(role)}
                  onChange={(event) => patchNode(active.id, { title: event.target.value })}
                />
                {(active.kind === "front" || active.kind === "back") && canWrite(role) ? (
                  <label className="studio-shown">
                    <input type="checkbox" checked={active.included} onChange={(event) => patchNode(active.id, { included: event.target.checked })} />
                    Include in the book
                  </label>
                ) : null}
                <ManuscriptEditor
                  key={active.id}
                  bare
                  nodeId={active.id}
                  content={active.content}
                  readOnly={!editable}
                  suggesting={suggesting}
                  onEditor={setEditor}
                  onChange={(content) => patchNode(active.id, { content })}
                />
              </>
            ) : null}
          </div>
        </div>
        {index > 0 ? <button type="button" className="studio-nav prev" aria-label="Previous section" onClick={() => setActiveId(sequence[index - 1].id)}>‹</button> : null}
        {index >= 0 && index < sequence.length - 1 ? <button type="button" className="studio-nav next" aria-label="Next section" onClick={() => setActiveId(sequence[index + 1].id)}>›</button> : null}
      </section>

      {focus ? null : (
        <>
          {tool ? (
            <aside className="studio-drawer">
              <header>
                <strong>{toolTitle(tool)}</strong>
                <button type="button" onClick={() => setTool(null)} aria-label="Close">×</button>
              </header>
              {tool === "format" && editor ? (
                <div className="studio-format">
                  <ToolButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} />
                  <ToolButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} />
                  <ToolButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} />
                  <ToolButton label="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} />
                  <ToolButton label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                  <ToolButton label="List" onClick={() => editor.chain().focus().toggleBulletList().run()} />
                  <ToolButton label="Numbered" onClick={() => editor.chain().focus().toggleOrderedList().run()} />
                  <ToolButton label="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
                  <ToolButton label="Scene break" onClick={() => editor.chain().focus().insertContent({ type: "sceneBreak" }).run()} />
                  <ToolButton label="Footnote" onClick={() => {
                    const note = window.prompt("Footnote text");
                    if (!note) return;
                    editor.chain().focus().insertContent({ type: "footnote", attrs: { id: uid(), text: note } }).run();
                  }} />
                  <ToolButton label="Image" onClick={() => imageRef.current?.click()} />
                  <ToolButton label={suggesting ? "Suggesting" : "Suggest"} onClick={() => setSuggesting((value) => !value)} active={suggesting} />
                  <ToolButton label="Mark delete" onClick={() => editor.chain().focus().setMark("suggestionDelete").run()} />
                  <ToolButton label="Accept" onClick={() => editor.chain().focus().unsetMark("suggestionInsert").unsetMark("suggestionDelete").run()} />
                  <input ref={imageRef} type="file" accept="image/*" hidden onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void insertEditorImage(editor, file);
                  }} />
                </div>
              ) : null}
              {tool === "find" && editor ? (
                <form className="studio-form" onSubmit={(event) => { event.preventDefault(); revealFind(editor, find, setFindNote); }}>
                  <input placeholder="Find" value={find} onChange={(event) => { setFind(event.target.value); setFindNote(""); }} />
                  <input placeholder="Replace" value={replace} onChange={(event) => setReplace(event.target.value)} />
                  <div className="flex gap-2">
                    <button type="submit">Find</button>
                    <button type="button" onClick={() => setFindNote(replaceFind(editor, find, replace, false))}>Replace</button>
                    <button type="button" onClick={() => setFindNote(replaceFind(editor, find, replace, true))}>Replace all</button>
                  </div>
                  {findNote ? <p>{findNote}</p> : null}
                </form>
              ) : null}
              {tool === "spelling" ? (
                <div className="studio-form">
                  <p>{wordCountText(text).toLocaleString()} words in this section.</p>
                  <p>The browser underlines spelling and grammar in the page as you type.</p>
                  <p>{issues.doubles ? `${issues.doubles} double space${issues.doubles === 1 ? "" : "s"}.` : "No double spaces."}</p>
                  <p>{issues.repeats.length ? `Repeated words: ${issues.repeats.join(", ")}` : "No repeated words."}</p>
                </div>
              ) : null}
              {tool === "comments" && active && canComment(role) ? (
                <form className="studio-form" onSubmit={(event) => {
                  event.preventDefault();
                  if (!comment.trim()) return;
                  const quote = window.getSelection()?.toString().slice(0, 280) ?? "";
                  update((current) => ({
                    ...current,
                    comments: [...current.comments, { id: uid(), nodeId: active.id, userId: null, authorName: "You", quote, body: comment.trim(), type: "comment", resolved: false, createdAt: now(), updatedAt: now() }],
                  }));
                  setComment("");
                }}>
                  <textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Select text, then write a note." />
                  <button type="submit">Add comment</button>
                  <ul>
                    {bundle.comments.filter((item) => item.nodeId === active.id).map((item) => (
                      <li key={item.id}>{item.quote ? <p>“{item.quote}”</p> : null}<p>{item.body}</p></li>
                    ))}
                  </ul>
                </form>
              ) : null}
              {tool === "notes" ? (
                <div className="studio-form">
                  {pins.length === 0 ? <p>Pin a bible card to this chapter from the lore bible.</p> : null}
                  {pins.map((pin) => {
                    const card = bundle.cards.find((item) => item.id === pin.targetId);
                    const boardItem = bundle.boardItems.find((item) => item.id === pin.targetId);
                    return <article key={pin.id}><strong>{card?.title || boardItem?.title}</strong><p>{card?.notes || card?.appearance || boardItem?.body}</p></article>;
                  })}
                </div>
              ) : null}
              {tool === "split" ? (
                <div className="studio-form">
                  <p>Put the cursor where the new chapter should begin. The text after the cursor moves into the new chapter.</p>
                  <button type="button" disabled={!editable} onClick={splitActive}>Split chapter</button>
                </div>
              ) : null}
              {tool === "delete" ? (
                <div className="studio-form">
                  <p>Delete “{active?.title}”{active?.kind === "chapter" ? " and its scenes" : ""}.</p>
                  {confirmDelete ? <button type="button" className="is-danger" onClick={removeActive}>Confirm delete</button> : <button type="button" className="is-danger" disabled={!canWrite(role) || active?.matterKey === "title"} onClick={() => setConfirmDelete(true)}>Delete chapter</button>}
                </div>
              ) : null}
            </aside>
          ) : null}
          <nav className="studio-toolrail" aria-label="Writing tools">
            <RailButton label="Formatting" active={tool === "format"} onClick={() => toggleTool("format")} icon="format" />
            <RailButton label="Find and replace" active={tool === "find"} onClick={() => toggleTool("find")} icon="find" />
            <RailButton label="Spelling and grammar" active={tool === "spelling"} onClick={() => toggleTool("spelling")} icon="spelling" />
            <RailButton label="Comments" active={tool === "comments"} onClick={() => toggleTool("comments")} icon="comment" />
            <RailButton label="Pinned notes" active={tool === "notes"} onClick={() => toggleTool("notes")} icon="pin" />
            <RailButton label="Split chapter" active={tool === "split"} onClick={() => toggleTool("split")} icon="split" />
            <RailButton label="Delete chapter" active={tool === "delete"} onClick={() => toggleTool("delete")} icon="trash" />
            <span className="flex-1" />
            <RailButton label={focus ? "Leave focus" : "Focus"} active={focus} onClick={() => setFocus((value) => !value)} icon="focus" />
          </nav>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  closed,
  editing,
  onToggle,
  onEdit,
  children,
}: {
  title: string;
  closed: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="studio-section">
      <header>
        <button type="button" onClick={onToggle}>{closed ? "▸" : "▾"} {title}</button>
        <button type="button" className={editing ? "is-on" : ""} onClick={onEdit}>edit</button>
      </header>
      {closed ? null : children}
    </section>
  );
}

function DropHint({ label, onDrop }: { label: string; onDrop: () => void }) {
  return (
    <div className={`studio-drop ${label ? "" : "is-quiet"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(); }}>
      {label}
    </div>
  );
}

function ToolButton({ label, onClick, active = false }: { label: string; onClick: () => void; active?: boolean }) {
  return <button type="button" className={active ? "is-on" : ""} onClick={onClick}>{label}</button>;
}

function RailButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? "is-on" : ""} aria-label={label} title={label} onClick={onClick}>
      <RailIcon name={icon} />
    </button>
  );
}

function RailIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "format") return <svg {...common}><path d="M5 6h14M12 6v12M8 18h8" /></svg>;
  if (name === "find") return <svg {...common}><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>;
  if (name === "spelling") return <svg {...common}><path d="M5 18l4-12h2l4 12M7 13h6" /><path d="M17 14h3" /></svg>;
  if (name === "comment") return <svg {...common}><path d="M6 6h12v9H9l-3 3z" /></svg>;
  if (name === "pin") return <svg {...common}><path d="M9 4h6l-1 6 3 2v2H7v-2l3-2zM12 14v6" /></svg>;
  if (name === "split") return <svg {...common}><path d="M8 4v16M16 4v16M4 12h4M16 12h4" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /></svg>;
}

function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
      {[2, 7, 12].flatMap((y) => [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />))}
    </svg>
  );
}

function textMatches(doc: ProseNode, needle: string) {
  const found: { from: number; to: number }[] = [];
  if (!needle) return found;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let index = 0;
    while (index < node.text.length) {
      const at = node.text.indexOf(needle, index);
      if (at < 0) break;
      found.push({ from: pos + at, to: pos + at + needle.length });
      index = at + Math.max(needle.length, 1);
    }
  });
  return found;
}

function revealFind(editor: Editor, needle: string, note: (value: string) => void) {
  const matches = textMatches(editor.state.doc, needle);
  if (!matches.length) {
    note(needle ? "Not in this chapter." : "");
    return;
  }
  const next = matches.find((match) => match.from >= editor.state.selection.from) ?? matches[0];
  editor.chain().focus().setTextSelection(next).scrollIntoView().run();
  note(matches.length === 1 ? "1 match" : `${matches.length} matches`);
}

function replaceFind(editor: Editor, needle: string, replacement: string, all: boolean) {
  const matches = textMatches(editor.state.doc, needle);
  if (!matches.length) return needle ? "Not in this chapter." : "";
  const next = matches.find((match) => match.from >= editor.state.selection.from) ?? matches[0];
  const targets = all ? matches : [next];
  let tr = editor.state.tr;
  for (const target of [...targets].reverse()) tr = tr.insertText(replacement, target.from, target.to);
  editor.view.dispatch(tr);
  return all ? `Replaced ${targets.length}` : "Replaced 1";
}

function chooseSplit(doc: ProseNode, selectionAt: number) {
  const size = doc.content.size;
  const cursor = Math.max(0, Math.min(selectionAt, size));
  const bothSides = (at: number) => {
    const left = doc.cut(0, at).textContent.trim();
    const right = doc.cut(at).textContent.trim();
    return Boolean(left && right);
  };
  if (cursor > 1 && cursor < size && bothSides(cursor)) return cursor;
  if (doc.childCount > 1) {
    const total = doc.textContent.length;
    let at = 0;
    let seen = 0;
    let best: number | null = null;
    for (let index = 0; index < doc.childCount - 1; index += 1) {
      const child = doc.child(index);
      at += child.nodeSize;
      seen += child.textContent.length;
      if (seen > 0 && total - seen > 0) best = at;
      if (seen * 2 >= total && total - seen > 0) return at;
    }
    if (best != null) return best;
  }
  const halfway = Math.floor(doc.textContent.length / 2);
  if (halfway < 1) return null;
  let remaining = halfway;
  let found = 0;
  doc.descendants((node, position) => {
    if (found || !node.isText || !node.text) return true;
    if (remaining < node.text.length) {
      found = position + Math.max(1, remaining);
      return false;
    }
    remaining -= node.text.length;
    return false;
  });
  if (!found || found >= size || !bothSides(found)) return null;
  return found;
}

function toolTitle(tool: Tool) {
  if (tool === "format") return "Formatting";
  if (tool === "find") return "Find and replace";
  if (tool === "spelling") return "Spelling and grammar";
  if (tool === "comments") return "Comments";
  if (tool === "notes") return "Pinned notes";
  if (tool === "split") return "Split chapter";
  return "Delete chapter";
}

function sameBucket(node: DocNode, kind: DocNode["kind"]) {
  if (kind === "front") return node.kind === "front";
  if (kind === "back") return node.kind === "back";
  return node.kind === "part" || node.kind === "chapter" || node.kind === "scene";
}

function inBucket(node: DocNode, parentId: string | null, kind: DocNode["kind"]) {
  if ((node.parentId ?? null) !== parentId) return false;
  if (parentId) return true;
  return sameBucket(node, kind);
}

function contains(nodes: DocNode[], ancestorId: string, nodeId: string) {
  let current = nodes.find((node) => node.id === nodeId);
  while (current) {
    if (current.id === ancestorId) return true;
    const parentId = current.parentId;
    current = parentId ? nodes.find((node) => node.id === parentId) : undefined;
  }
  return false;
}

function readingOrder(nodes: DocNode[]) {
  const list: DocNode[] = [];
  const walk = (parentId: string | null, kinds: DocNode["kind"][]) => {
    for (const node of childrenOf(nodes, parentId).filter((item) => kinds.includes(item.kind))) {
      list.push(node);
      if (node.kind === "part" || node.kind === "chapter") walk(node.id, ["chapter", "scene"]);
    }
  };
  walk(null, ["front"]);
  walk(null, ["part", "chapter"]);
  walk(null, ["back"]);
  return list;
}

function chapterIndex(nodes: DocNode[], id: string) {
  const chapters = readingOrder(nodes).filter((node) => node.kind === "chapter" && node.parentId === null || (node.kind === "chapter" && nodes.find((item) => item.id === node.parentId)?.kind === "part"));
  const index = chapters.findIndex((node) => node.id === id);
  return index < 0 ? 0 : index + 1;
}
