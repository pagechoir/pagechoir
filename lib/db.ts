import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import {
  bookWordCount,
  createBundle,
  mergeBundles,
  normalizeBundle,
  now,
  uid,
  type BookBundle,
  type BookMeta,
  type Comment,
  type Role,
  type Tombstone,
} from "./model";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const loginSessions = pgTable("login_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  userAgent: text("user_agent").notNull(),
});

export const books = pgTable("books", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  wordCount: integer("word_count").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  data: jsonb("data").$type<BookMeta>().notNull(),
});

function entityTable(name: string) {
  return pgTable(name, {
    id: text("id").primaryKey(),
    bookId: text("book_id").notNull(),
    updatedAt: text("updated_at").notNull(),
    data: jsonb("data").notNull(),
  });
}

export const nodes = entityTable("nodes");
export const collections = entityTable("collections");
export const cards = entityTable("cards");
export const tags = entityTable("tags");
export const groups = entityTable("groups");
export const links = entityTable("links");
export const boards = entityTable("boards");
export const folders = entityTable("folders");
export const boardItems = entityTable("board_items");
export const pins = entityTable("pins");
export const layers = entityTable("timeline_layers");
export const connectors = entityTable("connectors");
export const checkIns = entityTable("check_ins");
export const activity = entityTable("activity_days");
export const comments = entityTable("comments");
export const shares = pgTable("shares", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  updatedAt: text("updated_at").notNull(),
  token: text("token").notNull(),
  data: jsonb("data").notNull(),
});
export const collaborators = pgTable("collaborators", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  updatedAt: text("updated_at").notNull(),
  email: text("email").notNull(),
  userId: text("user_id"),
  role: text("role").notNull(),
  status: text("status").notNull(),
  data: jsonb("data").notNull(),
});
export const goals = pgTable("goals", {
  bookId: text("book_id").primaryKey(),
  updatedAt: text("updated_at").notNull(),
  data: jsonb("data").notNull(),
});
export const tombstones = pgTable(
  "tombstones",
  {
    bookId: text("book_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    at: text("at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.bookId, table.entityType, table.entityId] })],
);
export const versions = pgTable("versions", {
  id: text("id").primaryKey(),
  bookId: text("book_id").notNull(),
  name: text("name").notNull(),
  auto: integer("auto").notNull(),
  snapshot: jsonb("snapshot").$type<BookBundle>().notNull(),
  createdAt: text("created_at").notNull(),
});
export const memberState = pgTable(
  "member_state",
  {
    userId: text("user_id").notNull(),
    bookId: text("book_id").notNull(),
    lastOpenedAt: text("last_opened_at").notNull(),
    lastCommentSeenAt: text("last_comment_seen_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.bookId] })],
);

const STATEMENTS = [
  `create table if not exists users (
    id text primary key,
    email text not null unique,
    name text not null,
    password_hash text not null,
    created_at text not null
  )`,
  `create table if not exists login_sessions (
    id text primary key,
    user_id text not null,
    created_at text not null,
    user_agent text not null
  )`,
  `create table if not exists books (
    id text primary key,
    owner_id text not null,
    title text not null,
    author_name text not null,
    word_count integer not null,
    created_at text not null,
    updated_at text not null,
    data jsonb not null
  )`,
  ...[
    "nodes",
    "collections",
    "cards",
    "tags",
    "groups",
    "links",
    "boards",
    "folders",
    "board_items",
    "pins",
    "timeline_layers",
    "connectors",
    "check_ins",
    "activity_days",
    "comments",
  ].map(
    (name) => `create table if not exists ${name} (
      id text primary key,
      book_id text not null,
      updated_at text not null,
      data jsonb not null
    )`,
  ),
  `create table if not exists shares (
    id text primary key,
    book_id text not null,
    updated_at text not null,
    token text not null,
    data jsonb not null
  )`,
  `create table if not exists collaborators (
    id text primary key,
    book_id text not null,
    updated_at text not null,
    email text not null,
    user_id text,
    role text not null,
    status text not null,
    data jsonb not null
  )`,
  `create table if not exists goals (
    book_id text primary key,
    updated_at text not null,
    data jsonb not null
  )`,
  `create table if not exists tombstones (
    book_id text not null,
    entity_type text not null,
    entity_id text not null,
    at text not null,
    primary key (book_id, entity_type, entity_id)
  )`,
  `create table if not exists versions (
    id text primary key,
    book_id text not null,
    name text not null,
    auto integer not null,
    snapshot jsonb not null,
    created_at text not null
  )`,
  `create table if not exists member_state (
    user_id text not null,
    book_id text not null,
    last_opened_at text not null,
    last_comment_seen_at text not null,
    primary key (user_id, book_id)
  )`,
];

// Drizzle's Neon and PGlite clients share one query API. The concrete class differs, so the handle stays loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

let ready: Promise<Database> | null = null;

async function migrate(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

export function getDb() {
  if (!ready) ready = openDb();
  return ready;
}

async function openDb(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    await migrate(db);
    return db as unknown as Database;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(path.join(dir, "pagechoir"));
  const db = drizzle(client);
  await migrate(db);
  return db as unknown as Database;
}

function rowsOf<T>(rows: { data: unknown }[]): T[] {
  return rows.map((row) => row.data as T);
}

export async function loadBundle(db: Database, bookId: string): Promise<BookBundle | null> {
  const [bookRow] = await db.select().from(books).where(eq(books.id, bookId));
  if (!bookRow) return null;
  const [
    nodeRows,
    collectionRows,
    cardRows,
    tagRows,
    groupRows,
    linkRows,
    boardRows,
    folderRows,
    itemRows,
    pinRows,
    layerRows,
    connectorRows,
    checkInRows,
    activityRows,
    commentRows,
    shareRows,
    collaboratorRows,
    goalRows,
    tombRows,
  ] = await Promise.all([
    db.select().from(nodes).where(eq(nodes.bookId, bookId)),
    db.select().from(collections).where(eq(collections.bookId, bookId)),
    db.select().from(cards).where(eq(cards.bookId, bookId)),
    db.select().from(tags).where(eq(tags.bookId, bookId)),
    db.select().from(groups).where(eq(groups.bookId, bookId)),
    db.select().from(links).where(eq(links.bookId, bookId)),
    db.select().from(boards).where(eq(boards.bookId, bookId)),
    db.select().from(folders).where(eq(folders.bookId, bookId)),
    db.select().from(boardItems).where(eq(boardItems.bookId, bookId)),
    db.select().from(pins).where(eq(pins.bookId, bookId)),
    db.select().from(layers).where(eq(layers.bookId, bookId)),
    db.select().from(connectors).where(eq(connectors.bookId, bookId)),
    db.select().from(checkIns).where(eq(checkIns.bookId, bookId)),
    db.select().from(activity).where(eq(activity.bookId, bookId)),
    db.select().from(comments).where(eq(comments.bookId, bookId)),
    db.select().from(shares).where(eq(shares.bookId, bookId)),
    db.select().from(collaborators).where(eq(collaborators.bookId, bookId)),
    db.select().from(goals).where(eq(goals.bookId, bookId)),
    db.select().from(tombstones).where(eq(tombstones.bookId, bookId)),
  ]);
  return normalizeBundle({
    book: bookRow.data,
    nodes: rowsOf(nodeRows),
    collections: rowsOf(collectionRows),
    cards: rowsOf(cardRows),
    tags: rowsOf(tagRows),
    groups: rowsOf(groupRows),
    links: rowsOf(linkRows),
    boards: rowsOf(boardRows),
    folders: rowsOf(folderRows),
    boardItems: rowsOf(itemRows),
    pins: rowsOf(pinRows),
    layers: rowsOf(layerRows),
    connectors: rowsOf(connectorRows),
    checkIns: rowsOf(checkInRows),
    activity: rowsOf(activityRows),
    comments: rowsOf(commentRows),
    shares: rowsOf(shareRows),
    collaborators: rowsOf(collaboratorRows),
    goal: goalRows[0] ? (goalRows[0].data as BookBundle["goal"]) : null,
    tombstones: tombRows.map(
      (row: { entityType: Tombstone["type"]; entityId: string; at: string }) => ({
        type: row.entityType,
        id: row.entityId,
        at: row.at,
      }),
    ),
  });
}

async function putChildren(db: Database, table: { bookId: unknown }, bookId: string, rows: Record<string, unknown>[]) {
  await db.delete(table).where(eq(table.bookId as never, bookId));
  if (rows.length) await db.insert(table).values(rows);
}

function childRows(bookId: string, items: { id: string; updatedAt: string }[]) {
  return items.map((item) => ({ id: item.id, bookId, updatedAt: item.updatedAt, data: item }));
}

export async function writeBundle(db: Database, bundle: BookBundle) {
  const book = bundle.book;
  const values = {
    id: book.id,
    ownerId: book.ownerId,
    title: book.title,
    authorName: book.authorName,
    wordCount: bookWordCount(bundle),
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    data: book,
  };
  const [existing] = await db.select({ id: books.id }).from(books).where(eq(books.id, book.id));
  if (existing) await db.update(books).set(values).where(eq(books.id, book.id));
  else await db.insert(books).values(values);
  await putChildren(db, nodes, book.id, childRows(book.id, bundle.nodes));
  await putChildren(db, collections, book.id, childRows(book.id, bundle.collections));
  await putChildren(db, cards, book.id, childRows(book.id, bundle.cards));
  await putChildren(db, tags, book.id, childRows(book.id, bundle.tags));
  await putChildren(db, groups, book.id, childRows(book.id, bundle.groups));
  await putChildren(db, links, book.id, childRows(book.id, bundle.links));
  await putChildren(db, boards, book.id, childRows(book.id, bundle.boards));
  await putChildren(db, folders, book.id, childRows(book.id, bundle.folders));
  await putChildren(db, boardItems, book.id, childRows(book.id, bundle.boardItems));
  await putChildren(db, pins, book.id, childRows(book.id, bundle.pins));
  await putChildren(db, layers, book.id, childRows(book.id, bundle.layers));
  await putChildren(db, connectors, book.id, childRows(book.id, bundle.connectors));
  await putChildren(db, checkIns, book.id, childRows(book.id, bundle.checkIns));
  await putChildren(db, activity, book.id, childRows(book.id, bundle.activity));
  await putChildren(db, comments, book.id, childRows(book.id, bundle.comments));
  await putChildren(
    db,
    shares,
    book.id,
    bundle.shares.map((share) => ({ ...childRows(book.id, [share])[0], token: share.token })),
  );
  await putChildren(
    db,
    collaborators,
    book.id,
    bundle.collaborators.map((person) => ({
      ...childRows(book.id, [person])[0],
      email: person.email.toLowerCase(),
      userId: person.userId,
      role: person.role,
      status: person.status,
    })),
  );
  await db.delete(goals).where(eq(goals.bookId, book.id));
  if (bundle.goal) {
    await db.insert(goals).values({ bookId: book.id, updatedAt: bundle.goal.updatedAt, data: bundle.goal });
  }
  await db.delete(tombstones).where(eq(tombstones.bookId, book.id));
  if (bundle.tombstones.length) {
    await db.insert(tombstones).values(
      bundle.tombstones.map((tomb) => ({
        bookId: book.id,
        entityType: tomb.type,
        entityId: tomb.id,
        at: tomb.at,
      })),
    );
  }
}

export async function accessRole(userId: string, bookId: string): Promise<Role | null> {
  const db = await getDb();
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) return null;
  if (book.ownerId === userId) return "owner";
  const people = await db.select().from(collaborators).where(and(eq(collaborators.bookId, bookId), eq(collaborators.userId, userId)));
  const active = people.find((person: { status: string }) => person.status === "active");
  return (active?.role as Role | undefined) ?? null;
}

export async function createBook(ownerId: string, title: string, authorName: string) {
  const bundle = createBundle({ ownerId, title, authorName });
  const db = await getDb();
  await writeBundle(db, bundle);
  return bundle;
}

export async function syncBundle(bookId: string, incoming: BookBundle, role: Role) {
  const db = await getDb();
  return db.transaction(async (tx: Database) => {
    await tx.execute(sql`select id from books where id = ${bookId} for update`);
    const current = await loadBundle(tx, bookId);
    if (!current) return null;
    const merged = mergeBundles(current, normalizeBundle({ ...incoming, book: { ...incoming.book, id: bookId } }), role);
    merged.book.id = current.book.id;
    merged.book.ownerId = current.book.ownerId;
    merged.book.createdAt = current.book.createdAt;
    await writeBundle(tx, merged);
    return merged;
  });
}

export async function listBooks(userId: string) {
  const db = await getDb();
  const owned = await db.select().from(books).where(eq(books.ownerId, userId));
  const shared = await db.select().from(collaborators).where(and(eq(collaborators.userId, userId), eq(collaborators.status, "active")));
  const summaries = owned.map((book: { id: string; title: string; authorName: string; updatedAt: string; wordCount: number }) => ({
    id: book.id,
    title: book.title,
    authorName: book.authorName,
    updatedAt: book.updatedAt,
    wordCount: book.wordCount,
    role: "owner" as Role,
  }));
  for (const share of shared as { bookId: string; role: Role }[]) {
    if (summaries.some((item: { id: string }) => item.id === share.bookId)) continue;
    const [book] = await db.select().from(books).where(eq(books.id, share.bookId));
    if (!book) continue;
    summaries.push({
      id: book.id,
      title: book.title,
      authorName: book.authorName,
      updatedAt: book.updatedAt,
      wordCount: book.wordCount,
      role: share.role,
    });
  }
  return summaries.sort((a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteBook(bookId: string) {
  const db = await getDb();
  const tables = [nodes, collections, cards, tags, groups, links, boards, folders, boardItems, pins, layers, connectors, checkIns, activity, comments, shares, collaborators, goals, tombstones, versions, memberState];
  for (const table of tables) {
    const column = "bookId" in table ? table.bookId : null;
    if (!column) continue;
    await db.delete(table).where(eq(column as never, bookId));
  }
  await db.delete(books).where(eq(books.id, bookId));
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user ?? null;
}

export async function createUser(input: { email: string; name: string; passwordHash: string }) {
  const db = await getDb();
  const user = {
    id: uid(),
    email: input.email.toLowerCase(),
    name: input.name.trim() || input.email,
    passwordHash: input.passwordHash,
    createdAt: now(),
  };
  await db.insert(users).values(user);
  const pending = await db.select().from(collaborators).where(eq(collaborators.email, user.email));
  for (const person of pending as { id: string; userId: string | null; data: { status: string; userId: string | null } }[]) {
    if (person.userId) continue;
    await db
      .update(collaborators)
      .set({ userId: user.id, status: "active", data: { ...person.data, userId: user.id, status: "active" } })
      .where(eq(collaborators.id, person.id));
  }
  return user;
}

export async function recordLogin(userId: string, userAgent = "") {
  const db = await getDb();
  await db.insert(loginSessions).values({ id: uid(), userId, createdAt: now(), userAgent: userAgent.slice(0, 240) });
}

export async function listLogins(userId: string) {
  const db = await getDb();
  return db.select().from(loginSessions).where(eq(loginSessions.userId, userId)).orderBy(desc(loginSessions.createdAt));
}

export async function getMemberState(userId: string, bookId: string) {
  const db = await getDb();
  const [row] = await db.select().from(memberState).where(and(eq(memberState.userId, userId), eq(memberState.bookId, bookId)));
  return row ?? { userId, bookId, lastOpenedAt: "", lastCommentSeenAt: "" };
}

export async function markOpened(userId: string, bookId: string) {
  const db = await getDb();
  const [existing] = await db.select().from(memberState).where(and(eq(memberState.userId, userId), eq(memberState.bookId, bookId)));
  const previous = existing?.lastOpenedAt ?? "";
  const stamp = now();
  if (!existing) await db.insert(memberState).values({ userId, bookId, lastOpenedAt: stamp, lastCommentSeenAt: "" });
  else {
    await db
      .update(memberState)
      .set({ lastOpenedAt: stamp })
      .where(and(eq(memberState.userId, userId), eq(memberState.bookId, bookId)));
  }
  return previous;
}

export async function markCommentsSeen(userId: string, bookId: string) {
  const db = await getDb();
  const current = await getMemberState(userId, bookId);
  const stamp = now();
  const [existing] = await db.select().from(memberState).where(and(eq(memberState.userId, userId), eq(memberState.bookId, bookId)));
  if (!existing) {
    await db.insert(memberState).values({ userId, bookId, lastOpenedAt: current.lastOpenedAt || "", lastCommentSeenAt: stamp });
  } else {
    await db
      .update(memberState)
      .set({ lastCommentSeenAt: stamp })
      .where(and(eq(memberState.userId, userId), eq(memberState.bookId, bookId)));
  }
  return stamp;
}

export async function addVersion(bookId: string, name: string, auto: boolean, snapshot: BookBundle) {
  const db = await getDb();
  const row = { id: uid(), bookId, name, auto: auto ? 1 : 0, snapshot, createdAt: now() };
  await db.insert(versions).values(row);
  return { id: row.id, name: row.name, auto: row.auto, createdAt: row.createdAt };
}

export async function listVersions(bookId: string) {
  const db = await getDb();
  const rows = await db.select().from(versions).where(eq(versions.bookId, bookId)).orderBy(desc(versions.createdAt));
  return rows.map((row: { id: string; name: string; auto: number; createdAt: string }) => ({
    id: row.id,
    name: row.name,
    auto: Boolean(row.auto),
    createdAt: row.createdAt,
  }));
}

export async function getVersion(bookId: string, versionId: string) {
  const db = await getDb();
  const [row] = await db.select().from(versions).where(and(eq(versions.bookId, bookId), eq(versions.id, versionId)));
  return row ?? null;
}

export async function findShare(token: string) {
  const db = await getDb();
  const [share] = await db.select().from(shares).where(eq(shares.token, token));
  if (!share) return null;
  const bundle = await loadBundle(db, share.bookId);
  if (!bundle) return null;
  return { share: share.data as BookBundle["shares"][number], bundle };
}

export async function addComment(bookId: string, comment: Comment) {
  const db = await getDb();
  return db.transaction(async (tx: Database) => {
    const bundle = await loadBundle(tx, bookId);
    if (!bundle) return null;
    bundle.comments = [...bundle.comments.filter((item) => item.id !== comment.id), comment];
    await writeBundle(tx, bundle);
    return comment;
  });
}
