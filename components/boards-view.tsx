"use client";

import Link from "next/link";
import { useState } from "react";
import { useBook } from "@/components/book-provider";
import { boardFromTemplate } from "@/lib/templates";
import { canWrite, now, tombstone, uid, type BoardItem } from "@/lib/model";

export function BoardsView({ boardId }: { boardId?: string }) {
  const { bundle, update, role } = useBook();
  const [view, setView] = useState<"card" | "list" | "column">("card");
  const [selected, setSelected] = useState<string | null>(null);
  if (!bundle) return null;
  const board = bundle.boards.find((item) => item.id === boardId) ?? bundle.boards[0];
  const items = bundle.boardItems.filter((item) => item.boardId === board?.id);
  const folders = bundle.folders.filter((folder) => folder.boardId === board?.id);
  const current = items.find((item) => item.id === selected) ?? null;
  const editing = canWrite(role);

  function addBoard(template: "blank" | "research" | "three-act" | "hero" | "scene-sequel") {
    const seed = boardFromTemplate(template, bundle!.boards.length);
    update((book) => ({
      ...book,
      boards: [...book.boards, seed.board],
      folders: [...book.folders, ...seed.folders],
      boardItems: [...book.boardItems, ...seed.items],
    }));
  }

  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {bundle.boards.map((item) => (
          <Link key={item.id} href={`/books/${bundle.book.id}/boards/${item.id}`} className={`block rounded px-3 py-2 ${item.id === board?.id ? "bg-accent text-[var(--accent-ink)]" : "hover:bg-sidebar"}`}>
            {item.name}
          </Link>
        ))}
        {editing ? (
          <div className="space-y-1 text-sm">
            <button type="button" className="block underline" onClick={() => addBoard("blank")}>Blank board</button>
            <button type="button" className="block underline" onClick={() => addBoard("research")}>Research notes</button>
            <button type="button" className="block underline" onClick={() => addBoard("three-act")}>Three act</button>
            <button type="button" className="block underline" onClick={() => addBoard("hero")}>Hero&apos;s journey</button>
            <button type="button" className="block underline" onClick={() => addBoard("scene-sequel")}>Scene and sequel</button>
          </div>
        ) : null}
      </aside>
      {board ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl">{board.name}</h1>
            {(["card", "list", "column"] as const).map((mode) => (
              <button key={mode} type="button" className={`rounded-full px-3 py-1 text-sm ${view === mode ? "bg-ink text-paper" : "border border-line"}`} onClick={() => setView(mode)}>
                {mode}
              </button>
            ))}
            {editing ? (
              <>
                <button type="button" className="text-sm underline" onClick={() => update((book) => ({ ...book, folders: [...book.folders, { id: uid(), boardId: board.id, name: "Folder", order: folders.length, updatedAt: now() }] }))}>Add folder</button>
                <button type="button" className="text-sm underline" onClick={() => {
                  const item: BoardItem = { id: uid(), boardId: board.id, folderId: folders[0]?.id ?? null, title: "Note", body: "", attributes: [], order: items.length, updatedAt: now() };
                  update((book) => ({ ...book, boardItems: [...book.boardItems, item] }));
                  setSelected(item.id);
                }}>Add note</button>
              </>
            ) : null}
          </div>
          {view === "list" ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th>Title</th><th>Folder</th><th>Attributes</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t border-line" onClick={() => setSelected(item.id)}>
                    <td className="py-2">{item.title}</td>
                    <td>{folders.find((folder) => folder.id === item.folderId)?.name}</td>
                    <td>{item.attributes.map((attribute) => `${attribute.key}: ${attribute.value}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : view === "column" ? (
            <div className="flex gap-3 overflow-x-auto">
              {folders.map((folder) => (
                <div key={folder.id} className="min-w-56 rounded border border-line bg-sidebar p-2">
                  <h2 className="font-semibold">{folder.name}</h2>
                  {items.filter((item) => item.folderId === folder.id).map((item) => (
                    <button key={item.id} type="button" className="mt-2 block w-full rounded bg-paper-2 p-2 text-left" onClick={() => setSelected(item.id)}>{item.title}</button>
                  ))}
                </div>
              ))}
              <div className="min-w-56 rounded border border-dashed border-line p-2">
                <h2 className="font-semibold">Loose</h2>
                {items.filter((item) => !item.folderId).map((item) => (
                  <button key={item.id} type="button" className="mt-2 block w-full rounded bg-paper-2 p-2 text-left" onClick={() => setSelected(item.id)}>{item.title}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <button key={item.id} type="button" className="page-sheet p-3 text-left" onClick={() => setSelected(item.id)}>
                  <strong>{item.title}</strong>
                  <p className="mt-1 text-sm text-muted">{item.body.slice(0, 140)}</p>
                </button>
              ))}
            </div>
          )}
          {current ? (
            <form className="page-sheet mt-4 space-y-2 p-4 text-sm" onSubmit={(event) => event.preventDefault()}>
              <input className="w-full rounded border border-line bg-paper-2 px-2 py-1" value={current.title} disabled={!editing} onChange={(event) => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, title: event.target.value, updatedAt: now() } : item) }))} />
              <textarea className="w-full rounded border border-line bg-paper-2 p-2" rows={4} value={current.body} disabled={!editing} onChange={(event) => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, body: event.target.value, updatedAt: now() } : item) }))} />
              <label>
                Folder
                <select className="ml-2 rounded border border-line bg-paper-2 px-2 py-1" value={current.folderId ?? ""} disabled={!editing} onChange={(event) => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, folderId: event.target.value || null, updatedAt: now() } : item) }))}>
                  <option value="">None</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
              {current.attributes.map((attribute) => (
                <div key={attribute.id} className="flex gap-2">
                  <input className="w-32 rounded border border-line px-2 py-1" value={attribute.key} disabled={!editing} onChange={(event) => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, updatedAt: now(), attributes: item.attributes.map((entry) => entry.id === attribute.id ? { ...entry, key: event.target.value } : entry) } : item) }))} />
                  <input className="flex-1 rounded border border-line px-2 py-1" value={attribute.value} disabled={!editing} onChange={(event) => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, updatedAt: now(), attributes: item.attributes.map((entry) => entry.id === attribute.id ? { ...entry, value: event.target.value } : entry) } : item) }))} />
                </div>
              ))}
              {editing ? (
                <button type="button" className="underline" onClick={() => update((book) => ({ ...book, boardItems: book.boardItems.map((item) => item.id === current.id ? { ...item, updatedAt: now(), attributes: [...item.attributes, { id: uid(), key: "Label", value: "" }] } : item) }))}>Add attribute</button>
              ) : null}
              <label className="block">
                Link to another note
                <span className="mt-1 flex gap-2">
                  <select id="board-link" className="rounded border border-line px-2 py-1" defaultValue="">
                    {items.filter((item) => item.id !== current.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <button type="button" className="underline" onClick={() => {
                    const select = document.getElementById("board-link") as HTMLSelectElement | null;
                    if (!select?.value) return;
                    update((book) => ({ ...book, links: [...book.links, { id: uid(), fromType: "boardItem", fromId: current.id, toType: "boardItem", toId: select.value, label: "related", updatedAt: now() }] }));
                  }}>Link</button>
                </span>
              </label>
              {editing ? (
                <button type="button" className="text-coral underline" onClick={() => update((book) => {
                  const next = { ...book, boardItems: book.boardItems.filter((item) => item.id !== current.id) };
                  tombstone(next, "boardItem", current.id);
                  return next;
                })}>Delete note</button>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : <p>Create a board to start planning.</p>}
    </div>
  );
}
