"use client";

import { useEffect, useMemo, useState } from "react";
import { useBook } from "@/components/book-provider";
import { clockLabel, clockSort, compareClocks, decomposeSort, sortAt } from "@/lib/clock";
import { blankCard, canWrite, now, tombstone, uid, type Card } from "@/lib/model";

export function TimelineView() {
  const { bundle, update, role } = useBook();
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const editing = canWrite(role);
  const visibleConnectors = useMemo(() => {
    if (!bundle) return [];
    if (showAll) return bundle.connectors;
    if (!selected) return [];
    return bundle.connectors.filter((connector) => connector.fromId === selected || connector.toId === selected);
  }, [bundle, selected, showAll]);

  useEffect(() => {
    const target = window as Window & { __pagechoirConnect?: (from: string, to: string) => void };
    target.__pagechoirConnect = (from, to) => {
      if (!editing) return;
      update((book) => {
        if (book.connectors.some((connector) => connector.fromId === from && connector.toId === to)) return book;
        return { ...book, connectors: [...book.connectors, { id: uid(), fromId: from, toId: to, label: "", updatedAt: now() }] };
      });
    };
    return () => {
      delete target.__pagechoirConnect;
    };
  }, [editing, update]);

  if (!bundle) return null;
  const eventsCollection = bundle.collections.find((collection) => collection.kind === "events");
  const characters = bundle.cards.filter((card) => bundle.collections.find((collection) => collection.id === card.collectionId)?.kind === "characters");
  const events = bundle.cards.filter((card) => card.collectionId === eventsCollection?.id);
  const placed = events.filter((event) => event.clock.placed).slice().sort((a, b) => compareClocks(a.clock, b.clock));
  const unplaced = events.filter((event) => !event.clock.placed);
  const sorts = placed.map((event) => clockSort(event.clock));
  const min = sorts.length ? Math.min(...sorts) : 0;
  const max = sorts.length ? Math.max(...sorts) : 1;
  const span = Math.max(1, max - min);
  const layers = bundle.layers
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((layer) => ({ layer, character: characters.find((card) => card.id === layer.characterId) }))
    .filter((entry) => entry.character);

  const position = (event: Card) => `${((clockSort(event.clock) - min) / span) * 100}%`;

  function setClock(id: string, patch: Partial<Card["clock"]>) {
    update((book) => ({
      ...book,
      cards: book.cards.map((card) => (card.id === id ? { ...card, updatedAt: now(), clock: { ...card.clock, ...patch } } : card)),
    }));
  }

  function createEvent() {
    if (!eventsCollection) return;
    const card = blankCard(eventsCollection, events.length);
    update((book) => ({ ...book, cards: [...book.cards, card] }));
    setSelected(card.id);
  }

  function onLaneDrop(event: React.DragEvent<HTMLDivElement>) {
    const id = event.dataTransfer.getData("text/plain") || dragging || "";
    if (!id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const sort = sortAt(ratio, min, max);
    const current = events.find((item) => item.id === id);
    const clock = decomposeSort(sort, current?.clock.era ?? "", current?.clock.label ?? "");
    setClock(id, clock);
  }

  return (
    <div className="px-4 py-4" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl">Timeline</h1>
        <label className="text-sm">
          <input type="checkbox" className="mr-2" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          Show all
        </label>
        {editing ? <button type="button" className="rounded bg-accent px-3 py-1 text-sm text-[var(--accent-ink)]" onClick={createEvent}>New event</button> : null}
        {editing ? (
          <select aria-label="Add character lane" className="rounded border border-line bg-paper-2 px-2 py-1 text-sm" defaultValue="" onChange={(event) => {
            const characterId = event.target.value;
            event.target.value = "";
            if (!characterId || bundle.layers.some((layer) => layer.characterId === characterId)) return;
            update((book) => ({ ...book, layers: [...book.layers, { id: uid(), characterId, order: book.layers.length, updatedAt: now() }] }));
          }}>
            <option value="">Add character lane</option>
            {characters.map((character) => <option key={character.id} value={character.id}>{character.title}</option>)}
          </select>
        ) : null}
      </div>
      <div className="page-sheet relative overflow-x-auto p-4" onClick={() => setSelected(null)}>
        <Lane name="Everyone" events={placed} position={position} selected={selected} onSelect={setSelected} onDrop={onLaneDrop} connectors={visibleConnectors} placed={placed} dragging={dragging} setDragging={setDragging} />
        {layers.map(({ layer, character }) => (
          <div key={layer.id}>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span>{character?.title}</span>
              {editing ? (
                <>
                  <button type="button" className="underline" onClick={() => update((book) => ({ ...book, layers: book.layers.map((item) => item.id === layer.id ? { ...item, order: item.order - 1, updatedAt: now() } : item) }))}>Up</button>
                  <button type="button" className="underline" onClick={() => update((book) => ({ ...book, layers: book.layers.map((item) => item.id === layer.id ? { ...item, order: item.order + 1, updatedAt: now() } : item) }))}>Down</button>
                  <button type="button" className="underline" onClick={() => update((book) => {
                    const next = { ...book, layers: book.layers.filter((item) => item.id !== layer.id) };
                    tombstone(next, "layer", layer.id);
                    return next;
                  })}>Remove</button>
                </>
              ) : null}
            </div>
            <Lane
              name={character?.title || "Character"}
              events={placed.filter((item) => item.participantIds.includes(layer.characterId))}
              position={position}
              selected={selected}
              onSelect={setSelected}
              onDrop={onLaneDrop}
              connectors={visibleConnectors}
              placed={placed}
              dragging={dragging}
              setDragging={setDragging}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <section>
          <h2 className="font-semibold">Unplaced</h2>
          {unplaced.length === 0 ? <p className="text-sm text-muted">Every event has a time.</p> : null}
          <ul className="mt-2 space-y-1 text-sm">
            {unplaced.map((event) => (
              <li key={event.id} draggable onDragStart={(drag) => drag.dataTransfer.setData("text/plain", event.id)}>
                <button type="button" className="rounded border border-line px-2 py-1" onClick={() => setSelected(event.id)}>{event.title}</button>
              </li>
            ))}
          </ul>
        </section>
        {selected ? <EventEditor id={selected} /> : <p className="text-sm text-muted">Select an event to edit its clock. Connectors stay hidden until you do.</p>}
      </div>
    </div>
  );
}

function Lane({
  name,
  events,
  position,
  selected,
  onSelect,
  onDrop,
  connectors,
  placed,
  dragging,
  setDragging,
}: {
  name: string;
  events: Card[];
  position: (event: Card) => string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  connectors: { id: string; fromId: string; toId: string }[];
  placed: Card[];
  dragging: string | null;
  setDragging: (id: string | null) => void;
}) {
  return (
    <div className="lane" aria-label={name} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={(event) => event.stopPropagation()}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {connectors.map((connector) => {
          const from = placed.find((event) => event.id === connector.fromId);
          const to = placed.find((event) => event.id === connector.toId);
          if (!from || !to) return null;
          if (!events.some((event) => event.id === from.id) && !events.some((event) => event.id === to.id)) return null;
          return <line key={connector.id} x1={position(from)} x2={position(to)} y1="46" y2="46" stroke="currentColor" strokeWidth="1.5" />;
        })}
      </svg>
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          data-event-id={event.id}
          draggable
          className={`event-dot rounded border px-2 py-1 text-left text-xs ${selected === event.id ? "border-accent bg-paper-2" : "border-line bg-paper-2"}`}
          style={{ left: position(event) }}
          onClick={(click) => {
            click.stopPropagation();
            onSelect(event.id);
          }}
          onDragStart={(drag) => {
            drag.dataTransfer.setData("text/plain", event.id);
            setDragging(event.id);
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(drag) => drag.preventDefault()}
          onDrop={(drag) => {
            drag.stopPropagation();
            const source = drag.dataTransfer.getData("text/plain") || dragging;
            if (!source || source === event.id) return;
            const custom = new Event("connector");
            drag.currentTarget.dispatchEvent(custom);
            const bookUpdate = (window as Window & { __pagechoirConnect?: (from: string, to: string) => void }).__pagechoirConnect;
            bookUpdate?.(source, event.id);
          }}
        >
          <strong className="block truncate">{event.title}</strong>
          <span className="text-muted">{clockLabel(event.clock)}</span>
        </button>
      ))}
    </div>
  );
}

function EventEditor({ id }: { id: string }) {
  const { bundle, update, role } = useBook();
  if (!bundle) return null;
  const card = bundle.cards.find((item) => item.id === id);
  if (!card) return null;
  const editing = canWrite(role);
  const characters = bundle.cards.filter((item) => bundle.collections.find((collection) => collection.id === item.collectionId)?.kind === "characters");
  return (
    <form className="page-sheet space-y-2 p-4 text-sm" onClick={(event) => event.stopPropagation()}>
      <input className="w-full rounded border border-line bg-paper-2 px-2 py-1" value={card.title} disabled={!editing} onChange={(event) => update((book) => ({ ...book, cards: book.cards.map((item) => item.id === id ? { ...item, title: event.target.value, updatedAt: now() } : item) }))} />
      <div className="grid grid-cols-2 gap-2">
        {(["era", "year", "month", "day", "hour", "minute", "label"] as const).map((key) => (
          <label key={key}>
            {key}
            <input className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" value={card.clock[key]} disabled={!editing} onChange={(event) => update((book) => ({ ...book, cards: book.cards.map((item) => item.id === id ? { ...item, updatedAt: now(), clock: { ...item.clock, [key]: event.target.value, placed: true } } : item) }))} />
          </label>
        ))}
      </div>
      <fieldset>
        <legend>Characters</legend>
        {characters.map((character) => (
          <label key={character.id} className="mr-3">
            <input type="checkbox" className="mr-1" checked={card.participantIds.includes(character.id)} disabled={!editing} onChange={(event) => update((book) => ({ ...book, cards: book.cards.map((item) => item.id === id ? { ...item, updatedAt: now(), participantIds: event.target.checked ? [...item.participantIds, character.id] : item.participantIds.filter((entry) => entry !== character.id) } : item) }))} />
            {character.title}
          </label>
        ))}
      </fieldset>
      <p className="text-muted">Drag from this event onto another while it is selected to connect them. Show all is off, so only this event&apos;s lines appear.</p>
      <ul>
        {bundle.connectors.filter((connector) => connector.fromId === id || connector.toId === id).map((connector) => (
          <li key={connector.id} className="flex gap-2">
            <span>{bundle.cards.find((item) => item.id === (connector.fromId === id ? connector.toId : connector.fromId))?.title}</span>
            {editing ? <button type="button" className="underline" onClick={() => update((book) => {
              const next = { ...book, connectors: book.connectors.filter((item) => item.id !== connector.id) };
              tombstone(next, "connector", connector.id);
              return next;
            })}>Remove</button> : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Sort key {clockSort(card.clock)}</p>
    </form>
  );
}
