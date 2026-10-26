export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type Role = "owner" | "coauthor" | "commenter" | "reader";

export type BookSettings = {
  theme: "modern" | "classic" | "ornament";
  trim: "trade" | "digest" | "standard" | "pocket" | "a5" | "custom";
  customWidth: number;
  customHeight: number;
  marginTop: number;
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
  dropCap: boolean;
  chapterNumbers: boolean;
  runningHeads: boolean;
  sceneBreak: string;
  sceneBreakImage: string;
  blankVerso: boolean;
  includeToc: boolean;
  coverImage: string;
};

export type BookMeta = {
  id: string;
  ownerId: string;
  title: string;
  subtitle: string;
  authorName: string;
  settings: BookSettings;
  createdAt: string;
  updatedAt: string;
};

export type NodeKind = "front" | "part" | "chapter" | "scene" | "back";

export type DocNode = {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  matterKey: string;
  title: string;
  included: boolean;
  order: number;
  content: JSONContent;
  updatedAt: string;
};

export type CollectionKind =
  | "characters"
  | "locations"
  | "factions"
  | "items"
  | "events"
  | "lore"
  | "custom";

export type Collection = {
  id: string;
  kind: CollectionKind;
  name: string;
  order: number;
  updatedAt: string;
};

export type Clock = {
  era: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  label: string;
  placed: boolean;
};

export type CustomField = { id: string; label: string; value: string };

export type Card = {
  id: string;
  collectionId: string;
  title: string;
  tagIds: string[];
  groupIds: string[];
  portrait: string;
  aliases: string;
  pronouns: string;
  age: string;
  appearance: string;
  personality: string;
  goal: string;
  arc: string;
  backstory: string;
  notes: string;
  custom: CustomField[];
  clock: Clock;
  participantIds: string[];
  order: number;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  builtin: boolean;
  order: number;
  updatedAt: string;
};

export type Group = {
  id: string;
  name: string;
  order: number;
  updatedAt: string;
};

export type LinkEnd = "card" | "boardItem";

export type CardLink = {
  id: string;
  fromType: LinkEnd;
  fromId: string;
  toType: LinkEnd;
  toId: string;
  label: string;
  updatedAt: string;
};

export type Board = {
  id: string;
  name: string;
  order: number;
  updatedAt: string;
};

export type Folder = {
  id: string;
  boardId: string;
  name: string;
  order: number;
  updatedAt: string;
};

export type Attribute = { id: string; key: string; value: string };

export type BoardItem = {
  id: string;
  boardId: string;
  folderId: string | null;
  title: string;
  body: string;
  attributes: Attribute[];
  order: number;
  updatedAt: string;
};

export type Pin = {
  id: string;
  targetType: "card" | "boardItem";
  targetId: string;
  nodeId: string;
  order: number;
  updatedAt: string;
};

export type TimelineLayer = {
  id: string;
  characterId: string;
  order: number;
  updatedAt: string;
};

export type Connector = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  updatedAt: string;
};

export type Goal = {
  targetWords: number;
  deadline: string;
  weekdays: number[];
  updatedAt: string;
};

export type CheckIn = {
  id: string;
  day: string;
  note: string;
  words: number;
  updatedAt: string;
};

export type ActivityDay = {
  id: string;
  day: string;
  words: number;
  updatedAt: string;
};

export type Comment = {
  id: string;
  nodeId: string;
  userId: string | null;
  authorName: string;
  quote: string;
  body: string;
  type: "comment" | "suggestion";
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Collaborator = {
  id: string;
  email: string;
  userId: string | null;
  role: Exclude<Role, "owner">;
  status: "pending" | "active";
  updatedAt: string;
};

export type ShareLink = {
  id: string;
  token: string;
  nodeId: string | null;
  role: "reader" | "commenter";
  updatedAt: string;
};

export type EntityType =
  | "node"
  | "collection"
  | "card"
  | "tag"
  | "group"
  | "link"
  | "board"
  | "folder"
  | "boardItem"
  | "pin"
  | "layer"
  | "connector"
  | "checkIn"
  | "activity"
  | "comment"
  | "collaborator"
  | "share"
  | "goal";

export type Tombstone = { type: EntityType; id: string; at: string };

export type BookBundle = {
  book: BookMeta;
  nodes: DocNode[];
  collections: Collection[];
  cards: Card[];
  tags: Tag[];
  groups: Group[];
  links: CardLink[];
  boards: Board[];
  folders: Folder[];
  boardItems: BoardItem[];
  pins: Pin[];
  layers: TimelineLayer[];
  connectors: Connector[];
  goal: Goal | null;
  checkIns: CheckIn[];
  activity: ActivityDay[];
  comments: Comment[];
  collaborators: Collaborator[];
  shares: ShareLink[];
  tombstones: Tombstone[];
};

export const BUILTIN_TAGS = [
  "Protagonist",
  "Main character",
  "Supporting",
  "Antagonist",
  "Mentor",
  "Love interest",
  "Minor",
] as const;

export const TRIM_INCHES: Record<Exclude<BookSettings["trim"], "custom">, [number, number]> = {
  trade: [6, 9],
  digest: [5.5, 8.5],
  standard: [5, 8],
  pocket: [4.25, 6.87],
  a5: [5.83, 8.27],
};

export function uid() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function emptyClock(): Clock {
  return { era: "", year: "", month: "", day: "", hour: "", minute: "", label: "", placed: false };
}

export function defaultSettings(): BookSettings {
  return {
    theme: "classic",
    trim: "trade",
    customWidth: 6,
    customHeight: 9,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginInner: 0.85,
    marginOuter: 0.7,
    dropCap: true,
    chapterNumbers: true,
    runningHeads: true,
    sceneBreak: "✶",
    sceneBreakImage: "",
    blankVerso: true,
    includeToc: true,
    coverImage: "",
  };
}

export function trimInches(settings: BookSettings): [number, number] {
  if (settings.trim === "custom") {
    return [
      Math.min(12, Math.max(3, Number(settings.customWidth) || 6)),
      Math.min(14, Math.max(4, Number(settings.customHeight) || 9)),
    ];
  }
  return TRIM_INCHES[settings.trim];
}

function node(
  partial: Pick<DocNode, "kind" | "title" | "order"> &
    Partial<Pick<DocNode, "matterKey" | "included" | "parentId" | "content">>,
  stamp: string,
): DocNode {
  return {
    id: uid(),
    parentId: partial.parentId ?? null,
    kind: partial.kind,
    matterKey: partial.matterKey ?? "",
    title: partial.title,
    included: partial.included ?? true,
    order: partial.order,
    content: partial.content ?? emptyDoc(),
    updatedAt: stamp,
  };
}

export function createBundle(input: {
  id?: string;
  ownerId: string;
  title: string;
  authorName?: string;
}): BookBundle {
  const stamp = now();
  const bookId = input.id ?? uid();
  const year = new Date().getFullYear();
  const author = input.authorName?.trim() || "Author";
  const tags: Tag[] = BUILTIN_TAGS.map((name, order) => ({
    id: uid(),
    name,
    builtin: true,
    order,
    updatedAt: stamp,
  }));
  const collectionSeed: [CollectionKind, string][] = [
    ["characters", "Characters"],
    ["locations", "Locations"],
    ["factions", "Factions"],
    ["items", "Items"],
    ["events", "Events"],
    ["lore", "Lore"],
  ];
  return {
    book: {
      id: bookId,
      ownerId: input.ownerId,
      title: input.title.trim() || "Untitled book",
      subtitle: "",
      authorName: author,
      settings: defaultSettings(),
      createdAt: stamp,
      updatedAt: stamp,
    },
    nodes: [
      node({ kind: "front", matterKey: "title", title: "Title page", order: 0 }, stamp),
      node(
        {
          kind: "front",
          matterKey: "copyright",
          title: "Copyright",
          order: 1,
          content: paragraphDoc(
            `Copyright © ${year} ${author}\n\nAll rights reserved.\n\nISBN`,
          ),
        },
        stamp,
      ),
      node({ kind: "front", matterKey: "dedication", title: "Dedication", order: 2, included: false }, stamp),
      node({ kind: "front", matterKey: "epigraph", title: "Epigraph", order: 3, included: false }, stamp),
      node({ kind: "front", matterKey: "preface", title: "Preface", order: 4, included: false }, stamp),
      node({ kind: "chapter", title: "Chapter 1", order: 5 }, stamp),
      node({ kind: "back", matterKey: "acknowledgments", title: "Acknowledgments", order: 6, included: false }, stamp),
      node({ kind: "back", matterKey: "about", title: "About the author", order: 7, included: false }, stamp),
      node({ kind: "back", matterKey: "alsoBy", title: "Also by the author", order: 8, included: false }, stamp),
    ],
    collections: collectionSeed.map(([kind, name], order) => ({
      id: uid(),
      kind,
      name,
      order,
      updatedAt: stamp,
    })),
    cards: [],
    tags,
    groups: [],
    links: [],
    boards: [{ id: uid(), name: "Notes", order: 0, updatedAt: stamp }],
    folders: [],
    boardItems: [],
    pins: [],
    layers: [],
    connectors: [],
    goal: null,
    checkIns: [],
    activity: [],
    comments: [],
    collaborators: [],
    shares: [],
    tombstones: [],
  };
}

export function paragraphDoc(text: string): JSONContent {
  const blocks = text.split("\n\n").map((part) => ({
    type: "paragraph",
    content: part
      ? part.split("\n").flatMap((line, index, arr) => {
          const nodes: JSONContent[] = [{ type: "text", text: line }];
          if (index < arr.length - 1) nodes.push({ type: "hardBreak" });
          return nodes;
        })
      : [],
  }));
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

type Stamped = { id: string; updatedAt: string };

function mergeList<T extends Stamped>(
  server: T[],
  client: T[],
  tombstones: Tombstone[],
  type: EntityType,
): T[] {
  const map = new Map<string, T>();
  for (const item of server) map.set(item.id, item);
  for (const item of client) {
    const prev = map.get(item.id);
    if (!prev || item.updatedAt >= prev.updatedAt) map.set(item.id, item);
  }
  for (const tomb of tombstones) {
    if (tomb.type !== type) continue;
    const item = map.get(tomb.id);
    if (!item || tomb.at >= item.updatedAt) map.delete(tomb.id);
  }
  return [...map.values()];
}

function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const tomb of [...a, ...b]) {
    const key = `${tomb.type}:${tomb.id}`;
    const prev = map.get(key);
    if (!prev || tomb.at >= prev.at) map.set(key, tomb);
  }
  return [...map.values()];
}

export function mergeBundles(server: BookBundle, client: BookBundle, role: Role = "owner"): BookBundle {
  const base = normalizeBundle(server);
  const incoming = normalizeBundle(client);
  const tombstones = mergeTombstones(base.tombstones, incoming.tombstones).filter(
    (tomb) => role === "owner" || tomb.type !== "collaborator",
  );
  const goalCandidates = [base.goal, incoming.goal].filter((goal): goal is Goal => Boolean(goal));
  goalCandidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const goalTomb = tombstones
    .filter((tomb) => tomb.type === "goal")
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  let goal: Goal | null = goalCandidates[0] ?? null;
  if (goal && goalTomb && goalTomb.at >= goal.updatedAt) goal = null;

  const book =
    incoming.book.updatedAt >= base.book.updatedAt
      ? {
          ...incoming.book,
          id: base.book.id,
          ownerId: base.book.ownerId,
          createdAt: base.book.createdAt,
          settings: { ...defaultSettings(), ...incoming.book.settings },
        }
      : base.book;

  return normalizeBundle({
    book,
    nodes: mergeList(base.nodes, incoming.nodes, tombstones, "node"),
    collections: mergeList(base.collections, incoming.collections, tombstones, "collection"),
    cards: mergeList(base.cards, incoming.cards, tombstones, "card"),
    tags: mergeList(base.tags, incoming.tags, tombstones, "tag"),
    groups: mergeList(base.groups, incoming.groups, tombstones, "group"),
    links: mergeList(base.links, incoming.links, tombstones, "link"),
    boards: mergeList(base.boards, incoming.boards, tombstones, "board"),
    folders: mergeList(base.folders, incoming.folders, tombstones, "folder"),
    boardItems: mergeList(base.boardItems, incoming.boardItems, tombstones, "boardItem"),
    pins: mergeList(base.pins, incoming.pins, tombstones, "pin"),
    layers: mergeList(base.layers, incoming.layers, tombstones, "layer"),
    connectors: mergeList(base.connectors, incoming.connectors, tombstones, "connector"),
    goal,
    checkIns: mergeList(base.checkIns, incoming.checkIns, tombstones, "checkIn"),
    activity: mergeList(base.activity, incoming.activity, tombstones, "activity"),
    comments: mergeList(base.comments, incoming.comments, tombstones, "comment"),
    collaborators:
      role === "owner"
        ? mergeList(base.collaborators, incoming.collaborators, tombstones, "collaborator")
        : base.collaborators,
    shares: mergeList(base.shares, incoming.shares, tombstones, "share"),
    tombstones,
  });
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeBundle(input: Partial<BookBundle> & { book: BookMeta }): BookBundle {
  const settings = { ...defaultSettings(), ...(input.book.settings ?? {}) };
  return {
    book: { ...input.book, settings },
    nodes: asArray(input.nodes),
    collections: asArray(input.collections),
    cards: asArray(input.cards).map((card) => ({
      ...card,
      tagIds: asArray(card.tagIds),
      groupIds: asArray(card.groupIds),
      custom: asArray(card.custom),
      participantIds: asArray(card.participantIds),
      clock: { ...emptyClock(), ...(card.clock ?? {}) },
      portrait: card.portrait ?? "",
      aliases: card.aliases ?? "",
      pronouns: card.pronouns ?? "",
      age: card.age ?? "",
      appearance: card.appearance ?? "",
      personality: card.personality ?? "",
      goal: card.goal ?? "",
      arc: card.arc ?? "",
      backstory: card.backstory ?? "",
      notes: card.notes ?? "",
    })),
    tags: asArray(input.tags),
    groups: asArray(input.groups),
    links: asArray(input.links),
    boards: asArray(input.boards),
    folders: asArray(input.folders),
    boardItems: asArray(input.boardItems).map((item) => ({
      ...item,
      attributes: asArray(item.attributes),
      body: item.body ?? "",
    })),
    pins: asArray(input.pins),
    layers: asArray(input.layers),
    connectors: asArray(input.connectors),
    goal: input.goal ?? null,
    checkIns: asArray(input.checkIns),
    activity: asArray(input.activity),
    comments: asArray(input.comments),
    collaborators: asArray(input.collaborators),
    shares: asArray(input.shares),
    tombstones: asArray(input.tombstones),
  };
}

export function tombstone(bundle: BookBundle, type: EntityType, id: string) {
  bundle.tombstones = [
    ...bundle.tombstones.filter((item) => !(item.type === type && item.id === id)),
    { type, id, at: now() },
  ];
}

export function childrenOf(nodes: DocNode[], parentId: string | null) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .slice()
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function roots(nodes: DocNode[]) {
  return childrenOf(nodes, null);
}

export function wordCountText(text: string) {
  const matches = text.trim().match(/[\p{L}\p{N}’']+/gu);
  return matches ? matches.length : 0;
}

export function plainTextFromDoc(doc: JSONContent | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "hardBreak" || node.type === "sceneBreak") parts.push("\n");
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") parts.push("\n");
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function bookWordCount(bundle: BookBundle) {
  return bundle.nodes.reduce((sum, node) => sum + wordCountText(plainTextFromDoc(node.content)), 0);
}

export function canWrite(role: Role) {
  return role === "owner" || role === "coauthor";
}

export function canComment(role: Role) {
  return role === "owner" || role === "coauthor" || role === "commenter";
}

export function templateFields(kind: CollectionKind): CustomField[] {
  const field = (label: string): CustomField => ({ id: uid(), label, value: "" });
  if (kind === "locations") return [field("Region"), field("Sensory notes"), field("Story role")];
  if (kind === "factions") return [field("Agenda"), field("Members"), field("Public face")];
  if (kind === "items") return [field("Owner"), field("Significance")];
  if (kind === "lore") return [field("Topic"), field("What is known"), field("What is hidden")];
  if (kind === "custom") return [field("Notes")];
  return [];
}

export function blankCard(collection: Collection, order: number): Card {
  return {
    id: uid(),
    collectionId: collection.id,
    title: collection.kind === "events" ? "New event" : "Untitled",
    tagIds: [],
    groupIds: [],
    portrait: "",
    aliases: "",
    pronouns: "",
    age: "",
    appearance: "",
    personality: "",
    goal: "",
    arc: "",
    backstory: "",
    notes: "",
    custom: templateFields(collection.kind),
    clock: emptyClock(),
    participantIds: [],
    order,
    updatedAt: now(),
  };
}

export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addWrittenWords(bundle: BookBundle, delta: number) {
  if (delta <= 0) return bundle;
  const day = dayKey();
  const existing = bundle.activity.find((item) => item.day === day);
  const activity = existing
    ? bundle.activity.map((item) =>
        item.day === day ? { ...item, words: item.words + delta, updatedAt: now() } : item,
      )
    : [...bundle.activity, { id: uid(), day, words: delta, updatedAt: now() }];
  return { ...bundle, activity };
}

export function snapshotBundle(bundle: BookBundle): BookBundle {
  return normalizeBundle(structuredClone(bundle));
}

export function restoreBundle(current: BookBundle, snapshot: BookBundle): BookBundle {
  const stamp = now();
  const next = normalizeBundle(structuredClone(snapshot));
  next.book = {
    ...next.book,
    id: current.book.id,
    ownerId: current.book.ownerId,
    createdAt: current.book.createdAt,
    updatedAt: stamp,
  };
  const bump = <T extends Stamped>(items: T[]) => items.map((item) => ({ ...item, updatedAt: stamp }));
  next.nodes = bump(next.nodes);
  next.collections = bump(next.collections);
  next.cards = bump(next.cards);
  next.tags = bump(next.tags);
  next.groups = bump(next.groups);
  next.links = bump(next.links);
  next.boards = bump(next.boards);
  next.folders = bump(next.folders);
  next.boardItems = bump(next.boardItems);
  next.pins = bump(next.pins);
  next.layers = bump(next.layers);
  next.connectors = bump(next.connectors);
  next.checkIns = bump(next.checkIns);
  next.activity = bump(next.activity);
  next.comments = bump(next.comments);
  next.collaborators = current.collaborators;
  next.shares = bump(next.shares);
  if (next.goal) next.goal = { ...next.goal, updatedAt: stamp };

  const tombs: Tombstone[] = [];
  const drop = (type: EntityType, currentIds: string[], kept: { id: string }[]) => {
    const keep = new Set(kept.map((item) => item.id));
    for (const id of currentIds) {
      if (!keep.has(id)) tombs.push({ type, id, at: stamp });
    }
  };
  drop("node", current.nodes.map((item) => item.id), next.nodes);
  drop("collection", current.collections.map((item) => item.id), next.collections);
  drop("card", current.cards.map((item) => item.id), next.cards);
  drop("tag", current.tags.map((item) => item.id), next.tags);
  drop("group", current.groups.map((item) => item.id), next.groups);
  drop("link", current.links.map((item) => item.id), next.links);
  drop("board", current.boards.map((item) => item.id), next.boards);
  drop("folder", current.folders.map((item) => item.id), next.folders);
  drop("boardItem", current.boardItems.map((item) => item.id), next.boardItems);
  drop("pin", current.pins.map((item) => item.id), next.pins);
  drop("layer", current.layers.map((item) => item.id), next.layers);
  drop("connector", current.connectors.map((item) => item.id), next.connectors);
  drop("checkIn", current.checkIns.map((item) => item.id), next.checkIns);
  drop("activity", current.activity.map((item) => item.id), next.activity);
  drop("comment", current.comments.map((item) => item.id), next.comments);
  drop("share", current.shares.map((item) => item.id), next.shares);
  if (!next.goal && current.goal) tombs.push({ type: "goal", id: "goal", at: stamp });
  next.tombstones = mergeTombstones(current.tombstones, tombs);
  return next;
}
