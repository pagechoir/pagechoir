import { openDB } from "idb";
import type { BookBundle } from "./model";

const DB = "pagechoir";

async function database() {
  return openDB(DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books");
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
    },
  });
}

export async function readLocalBook(id: string) {
  const db = await database();
  return (await db.get("books", id)) as { bundle: BookBundle; savedAt: string } | undefined;
}

export async function writeLocalBook(bundle: BookBundle) {
  const db = await database();
  const savedAt = new Date().toISOString();
  await db.put("books", { bundle, savedAt }, bundle.book.id);
  return savedAt;
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
  entries: () => AsyncIterable<[string, FileSystemHandle]>;
};

export function folderSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function rememberFolder() {
  const picker = (window as Window & { showDirectoryPicker?: (options: { mode: "readwrite"; id: string }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  if (!picker) throw new Error("This browser cannot write to a chosen folder. Chrome, Edge, and Opera can.");
  const handle = await picker({ mode: "readwrite", id: "pagechoir" });
  const db = await database();
  await db.put("handles", handle, "folder");
  return true;
}

export async function forgetFolder() {
  const db = await database();
  await db.delete("handles", "folder");
}

export async function hasFolder() {
  const db = await database();
  const handle = await db.get("handles", "folder");
  return Boolean(handle);
}

async function writable(handle: DirectoryHandle) {
  const permission = await handle.queryPermission?.({ mode: "readwrite" });
  if (permission === "granted") return true;
  const next = await handle.requestPermission?.({ mode: "readwrite" });
  return next === "granted";
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, contents: string) {
  const file = await dir.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  await stream.write(contents);
  await stream.close();
}

export async function mirrorBook(bundle: BookBundle) {
  const db = await database();
  const handle = (await db.get("handles", "folder")) as DirectoryHandle | undefined;
  if (!handle) return false;
  if (!(await writable(handle))) return false;
  const root = await handle.getDirectoryHandle("Pagechoir", { create: true });
  const slug = `${bundle.book.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "book"}-${bundle.book.id.slice(0, 8)}`;
  const bookDir = await root.getDirectoryHandle(slug, { create: true });
  const payload = JSON.stringify(bundle);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snaps = await bookDir.getDirectoryHandle("snapshots", { create: true });
  await writeFile(snaps, `${stamp}.json`, payload);
  await writeFile(bookDir, "book.json", payload);
  const names: string[] = [];
  for await (const [name] of (snaps as DirectoryHandle).entries()) names.push(name);
  const extras = names.filter((name) => name.endsWith(".json")).sort();
  while (extras.length > 30) {
    const oldest = extras.shift();
    if (oldest) await snaps.removeEntry(oldest);
  }
  return true;
}
