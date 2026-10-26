"use client";

import { useState } from "react";
import { ManuscriptEditor } from "@/components/editor";
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
} from "@/lib/model";

export function Manuscript() {
  const { bundle, update, role, lastOpenedAt, markCaughtUp } = useBook();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [comment, setComment] = useState("");
  if (!bundle) return null;
  const active = bundle.nodes.find((node) => node.id === activeId) ?? bundle.nodes.find((node) => node.kind === "chapter") ?? bundle.nodes[0];
  const text = plainTextFromDoc(active?.content);
  const issues = writingIssues(text);
  const changed = bundle.nodes.filter((node) => lastOpenedAt && node.updatedAt > lastOpenedAt);
  const pins = bundle.pins.filter((pin) => pin.nodeId === active?.id || bundle.nodes.some((node) => node.id === pin.nodeId && node.parentId === active?.id));
  const editable = canWrite(role) && active?.matterKey !== "title";

  function patchNode(id: string, patch: Partial<DocNode>) {
    update((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch, updatedAt: now() } : node)),
    }));
  }

  function addNode(kind: DocNode["kind"], parentId: string | null) {
    const siblings = childrenOf(bundle!.nodes, parentId);
    const created: DocNode = {
      id: uid(),
      parentId,
      kind,
      matterKey: "",
      title: kind === "part" ? "Part" : kind === "scene" ? "Scene" : "Chapter",
      included: true,
      order: siblings.length ? Math.max(...siblings.map((node) => node.order)) + 1 : 1,
      content: emptyDoc(),
      updatedAt: now(),
    };
    update((current) => ({ ...current, nodes: [...current.nodes, created] }));
    setActiveId(created.id);
  }

  const tree = childrenOf(bundle.nodes, null);

  return (
    <div className={`grid gap-4 px-4 py-4 ${focus ? "" : "lg:grid-cols-[240px_minmax(0,1fr)_280px]"}`} style={{ ["--scene-break" as string]: JSON.stringify(bundle.book.settings.sceneBreak || "✶") }}>
      {focus ? null : (
        <aside className="space-y-2">
          <div className="flex flex-wrap gap-1 text-sm">
            <button type="button" className="rounded border border-line px-2 py-1" onClick={() => addNode("part", null)}>Part</button>
            <button type="button" className="rounded border border-line px-2 py-1" onClick={() => addNode("chapter", active?.kind === "part" ? active.id : active?.parentId && bundle.nodes.find((node) => node.id === active.parentId)?.kind === "part" ? active.parentId : null)}>Chapter</button>
            <button type="button" className="rounded border border-line px-2 py-1" onClick={() => active?.kind === "chapter" && addNode("scene", active.id)}>Scene</button>
            <button type="button" className="rounded border border-line px-2 py-1" onClick={() => setFocus(true)}>Focus</button>
          </div>
          {changed.length ? (
            <p className="rounded border border-line bg-paper-2 p-2 text-sm">
              {changed.length} section{changed.length === 1 ? "" : "s"} changed since you last opened this book.
              <button type="button" className="ml-2 underline" onClick={() => void markCaughtUp()}>
                Mark caught up
              </button>
            </p>
          ) : null}
          <ol className="space-y-1 text-sm">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} nodes={bundle.nodes} activeId={active?.id ?? ""} changed={changed.map((item) => item.id)} onSelect={setActiveId} onDrop={moveNode} />
            ))}
          </ol>
        </aside>
      )}
      <section className="page-sheet prose-page mx-auto w-full max-w-3xl px-8 py-10">
        {focus ? (
          <button type="button" className="mb-4 text-sm underline" onClick={() => setFocus(false)}>
            Leave focus
          </button>
        ) : null}
        {active ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              {active.kind === "front" || active.kind === "back" ? (
                <label className="text-sm text-muted">
                  <input type="checkbox" className="mr-2" checked={active.included} onChange={(event) => patchNode(active.id, { included: event.target.checked })} />
                  Include in the book
                </label>
              ) : null}
              {active.matterKey === "title" ? null : (
                <input className="w-full bg-transparent font-serif text-3xl outline-none" value={active.title} onChange={(event) => patchNode(active.id, { title: event.target.value })} readOnly={!canWrite(role)} />
              )}
            </div>
            {active.matterKey === "title" ? (
              <div className="space-y-3 text-center">
                <input className="w-full bg-transparent text-center font-serif text-4xl outline-none" value={bundle.book.title} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, title: event.target.value, updatedAt: now() } }))} />
                <input className="w-full bg-transparent text-center text-xl outline-none" placeholder="Subtitle" value={bundle.book.subtitle} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, subtitle: event.target.value, updatedAt: now() } }))} />
                <input className="w-full bg-transparent text-center outline-none" value={bundle.book.authorName} onChange={(event) => update((current) => ({ ...current, book: { ...current.book, authorName: event.target.value, updatedAt: now() } }))} />
              </div>
            ) : (
              <ManuscriptEditor
                nodeId={active.id}
                content={active.content}
                readOnly={!editable}
                onChange={(content) => patchNode(active.id, { content })}
              />
            )}
            {canWrite(role) && active.kind !== "front" ? (
              <button
                type="button"
                className="mt-6 text-sm text-coral underline"
                onClick={() => {
                  update((current) => {
                    const next = { ...current, nodes: current.nodes.filter((node) => node.id !== active.id && node.parentId !== active.id) };
                    tombstone(next, "node", active.id);
                    for (const child of current.nodes.filter((node) => node.parentId === active.id)) tombstone(next, "node", child.id);
                    return next;
                  });
                  setActiveId(null);
                }}
              >
                Delete section
              </button>
            ) : null}
          </>
        ) : null}
      </section>
      {focus ? null : (
        <aside className="space-y-4 text-sm">
          <p>{wordCountText(text).toLocaleString()} words in this section</p>
          <div>
            <h2 className="font-semibold">Spelling and repeats</h2>
            <p className="text-muted">The browser dictionary underlines misspellings in the page.</p>
            <p>{issues.doubles ? `${issues.doubles} double space${issues.doubles === 1 ? "" : "s"}` : "No double spaces."}</p>
            {issues.repeats.length ? <p>Repeated words: {issues.repeats.join(", ")}</p> : <p>No repeated words.</p>}
          </div>
          <div>
            <h2 className="font-semibold">Pinned notes</h2>
            {pins.length === 0 ? <p className="text-muted">Pin a bible card to this chapter from the lore bible.</p> : null}
            {pins.map((pin) => {
              const card = bundle.cards.find((item) => item.id === pin.targetId);
              const boardItem = bundle.boardItems.find((item) => item.id === pin.targetId);
              return (
                <article key={pin.id} className="mt-2 rounded border border-line bg-paper-2 p-2">
                  <strong>{card?.title || boardItem?.title}</strong>
                  <p className="text-muted">{card?.notes || card?.appearance || boardItem?.body}</p>
                </article>
              );
            })}
          </div>
          {canComment(role) && active ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!comment.trim()) return;
                const quote = window.getSelection()?.toString().slice(0, 280) ?? "";
                update((current) => ({
                  ...current,
                  comments: [
                    ...current.comments,
                    {
                      id: uid(),
                      nodeId: active.id,
                      userId: null,
                      authorName: "You",
                      quote,
                      body: comment.trim(),
                      type: "comment",
                      resolved: false,
                      createdAt: now(),
                      updatedAt: now(),
                    },
                  ],
                }));
                setComment("");
              }}
            >
              <h2 className="font-semibold">Comment</h2>
              <textarea className="mt-1 w-full rounded border border-line bg-paper-2 p-2" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Select text, then write a note." />
              <button className="mt-2 rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">
                Add comment
              </button>
              <ul className="mt-2 space-y-2">
                {bundle.comments
                  .filter((item) => item.nodeId === active.id)
                  .map((item) => (
                    <li key={item.id} className="rounded border border-line p-2">
                      {item.quote ? <p className="text-muted">“{item.quote}”</p> : null}
                      <p>{item.body}</p>
                    </li>
                  ))}
              </ul>
            </form>
          ) : null}
        </aside>
      )}
    </div>
  );

  function moveNode(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    update((current) => {
      const source = current.nodes.find((node) => node.id === sourceId);
      const target = current.nodes.find((node) => node.id === targetId);
      if (!source || !target || source.parentId !== target.parentId) return current;
      const siblings = childrenOf(current.nodes, source.parentId).filter((node) => node.id !== source.id);
      const index = siblings.findIndex((node) => node.id === target.id);
      siblings.splice(index, 0, source);
      const orders = new Map(siblings.map((node, order) => [node.id, order]));
      return {
        ...current,
        nodes: current.nodes.map((node) => (orders.has(node.id) ? { ...node, order: orders.get(node.id) ?? node.order, updatedAt: now() } : node)),
      };
    });
  }

}

function TreeNode({
  node,
  nodes,
  activeId,
  changed,
  onSelect,
  onDrop,
}: {
  node: DocNode;
  nodes: DocNode[];
  activeId: string;
  changed: string[];
  onSelect: (id: string) => void;
  onDrop: (sourceId: string, targetId: string) => void;
}) {
  const kids = childrenOf(nodes, node.id);
  return (
    <li
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", node.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("text/plain"), node.id);
      }}
    >
      <button type="button" className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${node.id === activeId ? "bg-accent text-[var(--accent-ink)]" : "hover:bg-sidebar"}`} onClick={() => onSelect(node.id)}>
        <span>{node.included ? node.title : `${node.title} (hidden)`}</span>
        {changed.includes(node.id) ? <span aria-label="Changed">●</span> : null}
      </button>
      {kids.length ? (
        <ol className="ml-3">
          {kids.map((child) => (
            <TreeNode key={child.id} node={child} nodes={nodes} activeId={activeId} changed={changed} onSelect={onSelect} onDrop={onDrop} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
