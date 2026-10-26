"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useBook } from "@/components/book-provider";
import { blankCard, canWrite, now, tombstone, uid, type Card, type Collection } from "@/lib/model";

export function BibleView({ slug }: { slug?: string }) {
  const { bundle, update, role } = useBook();
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [groupName, setGroupName] = useState("");
  if (!bundle) return null;
  const collection = bundle.collections.find((item) => item.kind === slug || item.id === slug) ?? bundle.collections[0];
  const editing = canWrite(role);
  let cards = bundle.cards.filter((card) => card.collectionId === collection?.id);
  if (collection?.kind === "characters") {
    if (tagFilter.length) cards = cards.filter((card) => card.tagIds.some((id) => tagFilter.includes(id)));
    if (groupFilter.length) cards = cards.filter((card) => card.groupIds.some((id) => groupFilter.includes(id)));
  }
  const current = cards.find((card) => card.id === selected) ?? cards[0] ?? null;

  function patchCard(id: string, patch: Partial<Card>) {
    update((book) => ({
      ...book,
      cards: book.cards.map((card) => (card.id === id ? { ...card, ...patch, updatedAt: now() } : card)),
    }));
  }

  return (
    <div className="grid gap-4 px-4 py-4 lg:grid-cols-[220px_280px_minmax(0,1fr)]">
      <aside className="space-y-1">
        {bundle.collections.map((item) => (
          <Link key={item.id} href={`/books/${bundle.book.id}/bible/${item.kind}`} className={`block rounded px-3 py-2 ${item.id === collection?.id ? "bg-accent text-[var(--accent-ink)]" : "hover:bg-sidebar"}`}>
            {item.name}
          </Link>
        ))}
        {editing ? (
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => {
              const name = window.prompt("Collection name");
              if (!name) return;
              const created: Collection = { id: uid(), kind: "custom", name, order: bundle.collections.length, updatedAt: now() };
              update((book) => ({ ...book, collections: [...book.collections, created] }));
            }}
          >
            Add collection
          </button>
        ) : null}
      </aside>
      <section>
        {collection?.kind === "characters" ? (
          <div className="mb-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-1">
              {bundle.tags.map((tag) => (
                <button key={tag.id} type="button" className={`rounded-full border px-2 py-0.5 ${tagFilter.includes(tag.id) ? "bg-accent text-[var(--accent-ink)]" : "border-line"}`} onClick={() => setTagFilter((ids) => (ids.includes(tag.id) ? ids.filter((id) => id !== tag.id) : [...ids, tag.id]))}>
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {bundle.groups.map((group) => (
                <button key={group.id} type="button" className={`rounded-full border px-2 py-0.5 ${groupFilter.includes(group.id) ? "bg-ink text-paper" : "border-line"}`} onClick={() => setGroupFilter((ids) => (ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id]))}>
                  {group.name}
                </button>
              ))}
            </div>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                <input className="rounded border border-line bg-paper-2 px-2 py-1" placeholder="Custom tag" value={tagName} onChange={(event) => setTagName(event.target.value)} />
                <button type="button" className="underline" onClick={() => {
                  if (!tagName.trim()) return;
                  update((book) => ({ ...book, tags: [...book.tags, { id: uid(), name: tagName.trim(), builtin: false, order: book.tags.length, updatedAt: now() }] }));
                  setTagName("");
                }}>Add tag</button>
                <input className="rounded border border-line bg-paper-2 px-2 py-1" placeholder="Group" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                <button type="button" className="underline" onClick={() => {
                  if (!groupName.trim()) return;
                  update((book) => ({ ...book, groups: [...book.groups, { id: uid(), name: groupName.trim(), order: book.groups.length, updatedAt: now() }] }));
                  setGroupName("");
                }}>Add group</button>
              </div>
            ) : null}
          </div>
        ) : null}
        {editing && collection ? (
          <button type="button" className="mb-2 rounded bg-accent px-3 py-1 text-sm text-[var(--accent-ink)]" onClick={() => {
            const card = blankCard(collection, cards.length);
            update((book) => ({ ...book, cards: [...book.cards, card] }));
            setSelected(card.id);
          }}>
            New {collection.name.replace(/s$/, "").toLowerCase() || "card"}
          </button>
        ) : null}
        <ul className="space-y-1">
          {cards.map((card) => (
            <li key={card.id}>
              <button type="button" className={`w-full rounded px-2 py-2 text-left ${card.id === current?.id ? "bg-sidebar" : "hover:bg-sidebar"}`} onClick={() => setSelected(card.id)}>
                <strong>{card.title}</strong>
                <span className="mt-1 block text-xs text-muted">{card.tagIds.map((id) => bundle.tags.find((tag) => tag.id === id)?.name).filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="page-sheet p-4">
        {current && collection ? (
          <CardForm card={current} collection={collection} editing={editing} onChange={(patch) => patchCard(current.id, patch)} onDelete={() => {
            update((book) => {
              const next = { ...book, cards: book.cards.filter((card) => card.id !== current.id) };
              tombstone(next, "card", current.id);
              return next;
            });
            setSelected(null);
          }} />
        ) : (
          <p className="text-muted">This collection is empty.</p>
        )}
      </section>
    </div>
  );
}

function CardForm({
  card,
  collection,
  editing,
  onChange,
  onDelete,
}: {
  card: Card;
  collection: Collection;
  editing: boolean;
  onChange: (patch: Partial<Card>) => void;
  onDelete: () => void;
}) {
  const { bundle, update } = useBook();
  if (!bundle) return null;
  const field = (label: string, key: keyof Card) => (
    <label className="block text-sm" key={key}>
      {label}
      <input className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" value={String(card[key] ?? "")} disabled={!editing} onChange={(event) => onChange({ [key]: event.target.value })} />
    </label>
  );
  return (
    <div className="space-y-3">
      {field("Name", "title")}
      {collection.kind === "characters" ? (
        <>
          <label className="block text-sm">
            Portrait
            <input type="file" accept="image/*" className="mt-1 block" disabled={!editing} onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onChange({ portrait: String(reader.result) });
              reader.readAsDataURL(file);
            }} />
          </label>
          {card.portrait ? <Image src={card.portrait} alt="" width={112} height={112} unoptimized className="h-28 w-28 rounded object-cover" /> : null}
          {field("Aliases", "aliases")}
          {field("Pronouns", "pronouns")}
          {field("Age", "age")}
          {field("Appearance", "appearance")}
          {field("Personality", "personality")}
          {field("Goal", "goal")}
          {field("Arc", "arc")}
          {field("Backstory", "backstory")}
          <fieldset>
            <legend className="text-sm font-semibold">Tags</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {bundle.tags.map((tag) => (
                <label key={tag.id} className="text-sm">
                  <input type="checkbox" className="mr-1" checked={card.tagIds.includes(tag.id)} disabled={!editing} onChange={(event) => onChange({ tagIds: event.target.checked ? [...card.tagIds, tag.id] : card.tagIds.filter((id) => id !== tag.id) })} />
                  {tag.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">Groups</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {bundle.groups.map((group) => (
                <label key={group.id} className="text-sm">
                  <input type="checkbox" className="mr-1" checked={card.groupIds.includes(group.id)} disabled={!editing} onChange={(event) => onChange({ groupIds: event.target.checked ? [...card.groupIds, group.id] : card.groupIds.filter((id) => id !== group.id) })} />
                  {group.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {collection.kind === "events" ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(["era", "year", "month", "day", "hour", "minute", "label"] as const).map((key) => (
            <label key={key}>
              {key}
              <input className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" value={card.clock[key]} disabled={!editing} onChange={(event) => onChange({ clock: { ...card.clock, [key]: event.target.value, placed: true } })} />
            </label>
          ))}
          <label className="col-span-2">
            <input type="checkbox" className="mr-2" checked={card.clock.placed} disabled={!editing} onChange={(event) => onChange({ clock: { ...card.clock, placed: event.target.checked } })} />
            Place on the timeline
          </label>
          <fieldset className="col-span-2">
            <legend>Characters in this event</legend>
            {bundle.cards
              .filter((item) => bundle.collections.find((entry) => entry.id === item.collectionId)?.kind === "characters")
              .map((character) => (
                <label key={character.id} className="mr-3">
                  <input type="checkbox" className="mr-1" checked={card.participantIds.includes(character.id)} disabled={!editing} onChange={(event) => onChange({ participantIds: event.target.checked ? [...card.participantIds, character.id] : card.participantIds.filter((id) => id !== character.id) })} />
                  {character.title}
                </label>
              ))}
          </fieldset>
        </div>
      ) : null}
      {card.custom.map((entry) => (
        <label key={entry.id} className="block text-sm">
          {entry.label}
          <input className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" value={entry.value} disabled={!editing} onChange={(event) => onChange({ custom: card.custom.map((field) => (field.id === entry.id ? { ...field, value: event.target.value } : field)) })} />
        </label>
      ))}
      <label className="block text-sm">
        Notes
        <textarea className="mt-1 w-full rounded border border-line bg-paper-2 p-2" rows={5} value={card.notes} disabled={!editing} onChange={(event) => onChange({ notes: event.target.value })} />
      </label>
      <label className="block text-sm">
        Relationship
        <span className="mt-1 flex gap-2">
          <select id={`link-${card.id}`} className="rounded border border-line bg-paper-2 px-2 py-1" defaultValue="">
            <option value="">Link to…</option>
            {bundle.cards.filter((item) => item.id !== card.id).map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <button type="button" className="underline" disabled={!editing} onClick={() => {
            const select = document.getElementById(`link-${card.id}`) as HTMLSelectElement | null;
            if (!select?.value) return;
            update((book) => ({
              ...book,
              links: [...book.links, { id: uid(), fromType: "card", fromId: card.id, toType: "card", toId: select.value, label: "connected", updatedAt: now() }],
            }));
          }}>Add</button>
        </span>
      </label>
      <ul className="text-sm text-muted">
        {bundle.links.filter((link) => link.fromId === card.id).map((link) => (
          <li key={link.id}>{link.label}: {bundle.cards.find((item) => item.id === link.toId)?.title}</li>
        ))}
      </ul>
      <label className="block text-sm">
        Pin beside a chapter
        <span className="mt-1 flex gap-2">
          <select id={`pin-${card.id}`} className="rounded border border-line bg-paper-2 px-2 py-1" defaultValue="">
            {bundle.nodes.filter((node) => node.kind === "chapter" || node.kind === "scene").map((node) => (
              <option key={node.id} value={node.id}>{node.title}</option>
            ))}
          </select>
          <button type="button" className="underline" disabled={!editing} onClick={() => {
            const select = document.getElementById(`pin-${card.id}`) as HTMLSelectElement | null;
            if (!select?.value) return;
            update((book) => ({
              ...book,
              pins: [...book.pins, { id: uid(), targetType: "card", targetId: card.id, nodeId: select.value, order: book.pins.length, updatedAt: now() }],
            }));
          }}>Pin</button>
        </span>
      </label>
      {editing ? <button type="button" className="text-sm text-coral underline" onClick={onDelete}>Delete card</button> : null}
    </div>
  );
}
