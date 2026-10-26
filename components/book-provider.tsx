"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addWrittenWords,
  bookWordCount,
  canWrite,
  mergeBundles,
  type BookBundle,
  type Role,
} from "@/lib/model";
import { hasFolder, mirrorBook, readLocalBook, requestPersistentStorage, writeLocalBook } from "@/lib/client-store";

type Status = "loading" | "local" | "synced" | "offline";

type BookContextValue = {
  bundle: BookBundle | null;
  role: Role;
  status: Status;
  savedAt: string | null;
  syncedAt: string | null;
  error: string | null;
  lastOpenedAt: string;
  lastCommentSeenAt: string;
  folderOn: boolean;
  sessionStarted: number;
  wordCount: number;
  update: (recipe: (current: BookBundle) => BookBundle) => void;
  refreshFolder: () => Promise<void>;
  markCaughtUp: () => Promise<void>;
  markCommentsRead: () => Promise<void>;
  reload: () => Promise<void>;
};

const BookContext = createContext<BookContextValue | null>(null);

export function useBook() {
  const value = useContext(BookContext);
  if (!value) throw new Error("useBook must be used inside a book");
  return value;
}

export function BookProvider({ bookId, children }: { bookId: string; children: React.ReactNode }) {
  const [bundle, setBundle] = useState<BookBundle | null>(null);
  const [role, setRole] = useState<Role>("reader");
  const [status, setStatus] = useState<Status>("loading");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOpenedAt, setLastOpenedAt] = useState("");
  const [lastCommentSeenAt, setLastCommentSeenAt] = useState("");
  const [folderOn, setFolderOn] = useState(false);
  const sessionStarted = useRef(Date.now());
  const bundleRef = useRef<BookBundle | null>(null);
  const wordsRef = useRef(0);
  const dirty = useRef(false);
  const durable = useRef(true);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const folderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remember = useCallback((next: BookBundle) => {
    bundleRef.current = next;
    setBundle(next);
  }, []);

  const pushServer = useCallback(async () => {
    const current = bundleRef.current;
    if (!current || !canWrite(role)) return;
    try {
      const response = await fetch(`/api/books/${bookId}/sync`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle: current }),
      });
      if (!response.ok) {
        setStatus("offline");
        return;
      }
      const payload = await response.json();
      const returned = payload.bundle as BookBundle;
      const pending = bundleRef.current;
      const merged = pending && pending !== current ? mergeBundles(returned, pending, role) : returned;
      if (!dirty.current || pending === current) {
        remember(merged);
        dirty.current = false;
        setStatus("synced");
        setSyncedAt(new Date().toISOString());
      } else {
        remember(merged);
        setStatus("local");
      }
      setError(null);
    } catch {
      setStatus("offline");
    }
  }, [bookId, remember, role]);

  const queue = useCallback(
    (next: BookBundle) => {
      dirty.current = true;
      durable.current = false;
      setStatus("local");
      void writeLocalBook(next).then((stamp) => {
        durable.current = true;
        setSavedAt(stamp);
      });
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void pushServer(), 800);
      if (folderTimer.current) clearTimeout(folderTimer.current);
      folderTimer.current = setTimeout(() => void mirrorBook(next), 2000);
    },
    [pushServer],
  );

  const update = useCallback(
    (recipe: (current: BookBundle) => BookBundle) => {
      const current = bundleRef.current;
      if (!current || !canWrite(role)) return;
      const before = bookWordCount(current);
      let next = recipe(current);
      const after = bookWordCount(next);
      next = addWrittenWords(next, after - before);
      wordsRef.current = after;
      remember(next);
      queue(next);
    },
    [queue, remember, role],
  );

  const load = useCallback(async () => {
    setStatus("loading");
    const local = await readLocalBook(bookId).catch(() => undefined);
    try {
      const response = await fetch(`/api/books/${bookId}`);
      if (!response.ok) {
        setError(response.status === 404 ? "That book is not on this account." : "The book could not be opened.");
        if (local) remember(local.bundle);
        setStatus(local ? "local" : "offline");
        return;
      }
      const payload = await response.json();
      setRole(payload.role);
      setLastOpenedAt(payload.lastOpenedAt || "");
      setLastCommentSeenAt(payload.lastCommentSeenAt || "");
      let next = payload.bundle as BookBundle;
      if (local?.bundle) next = mergeBundles(next, local.bundle, payload.role);
      remember(next);
      wordsRef.current = bookWordCount(next);
      setStatus("synced");
      setError(null);
      if (local && payload.role && (payload.role === "owner" || payload.role === "coauthor")) {
        const serverStamp = payload.bundle.book.updatedAt as string;
        if (local.bundle.book.updatedAt > serverStamp || local.bundle.nodes.some((node) => {
          const serverNode = payload.bundle.nodes.find((item: { id: string }) => item.id === node.id);
          return !serverNode || node.updatedAt > serverNode.updatedAt;
        })) {
          queue(next);
        }
      }
    } catch {
      if (local) {
        remember(local.bundle);
        setStatus("local");
      } else setStatus("offline");
      setError("Working from the copy saved in this browser.");
    }
  }, [bookId, queue, remember]);

  useEffect(() => {
    void requestPersistentStorage();
    void hasFolder().then(setFolderOn);
    void load();
  }, [load]);

  useEffect(() => {
    const flush = () => {
      const current = bundleRef.current;
      if (!current) return;
      void writeLocalBook(current);
      void mirrorBook(current);
      void fetch(`/api/books/${bookId}/sync`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle: current }),
        keepalive: true,
      }).catch(() => undefined);
      void fetch(`/api/books/${bookId}/seen`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", keepalive: true });
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (!durable.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", warn);
    };
  }, [bookId]);

  useEffect(() => {
    snapshotTimer.current = setInterval(() => {
      const current = bundleRef.current;
      if (!current || !dirty.current || !canWrite(role)) return;
      const stamp = new Date();
      void fetch(`/api/books/${bookId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Auto ${stamp.toLocaleString()}`, auto: true, snapshot: current }),
      });
    }, 5 * 60 * 1000);
    return () => {
      if (snapshotTimer.current) clearInterval(snapshotTimer.current);
    };
  }, [bookId, role]);

  const value = useMemo<BookContextValue>(
    () => ({
      bundle,
      role,
      status,
      savedAt,
      syncedAt,
      error,
      lastOpenedAt,
      lastCommentSeenAt,
      folderOn,
      sessionStarted: sessionStarted.current,
      wordCount: bundle ? bookWordCount(bundle) : 0,
      update,
      refreshFolder: async () => setFolderOn(await hasFolder()),
      markCaughtUp: async () => {
        const response = await fetch(`/api/books/${bookId}/seen`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        if (response.ok) setLastOpenedAt(new Date().toISOString());
      },
      markCommentsRead: async () => {
        const response = await fetch(`/api/books/${bookId}/seen`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ comments: true }),
        });
        if (response.ok) setLastCommentSeenAt(new Date().toISOString());
      },
      reload: load,
    }),
    [bundle, role, status, savedAt, syncedAt, error, lastOpenedAt, lastCommentSeenAt, folderOn, update, bookId, load],
  );

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}
