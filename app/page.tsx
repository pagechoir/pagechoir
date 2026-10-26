"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { applyImportedBlocks, htmlToImported } from "@/lib/import-book";
import { fileToHtml } from "@/lib/read-import";
import type { BookBundle, Role } from "@/lib/model";

type Summary = { id: string; title: string; authorName: string; updatedAt: string; wordCount: number; role: Role };

export default function BookshelfPage() {
  const { status } = useSession();
  const [books, setBooks] = useState<Summary[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const response = await fetch("/api/books");
    if (!response.ok) return;
    const payload = await response.json();
    setBooks(payload.books);
  }

  useEffect(() => {
    if (status === "authenticated") {
      void refresh().finally(() => setLoading(false));
    }
    if (status === "unauthenticated") setLoading(false);
  }, [status]);

  async function create(imported?: BookBundle) {
    setError("");
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: imported?.book.title || title || "Untitled book" }),
    });
    if (!response.ok) {
      setError("The book could not be created.");
      return;
    }
    const payload = await response.json();
    const bundle = imported ? { ...imported, book: { ...imported.book, id: payload.bundle.book.id, ownerId: payload.bundle.book.ownerId } } : payload.bundle;
    if (imported) {
      await fetch(`/api/books/${payload.bundle.book.id}/sync`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
    }
    window.location.href = `/books/${payload.bundle.book.id}/write`;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Pagechoir</p>
          <h1 className="font-serif text-5xl">Your shelf</h1>
          <p className="mt-2 max-w-xl text-muted">Draft, plan, and typeset a book. The advanced tools are included.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {status === "authenticated" ? (
            <>
              <Link href="/account" className="text-sm underline">Account</Link>
              <button type="button" className="text-sm underline" onClick={() => void signOut({ callbackUrl: "/login" })}>Sign out</button>
            </>
          ) : (
            <Link href="/login" className="rounded-full bg-accent px-4 py-2 text-[var(--accent-ink)]">Sign in</Link>
          )}
        </div>
      </header>
      {status === "authenticated" ? (
        <>
          <form className="mt-8 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void create(); }}>
            <input className="min-w-64 flex-1 rounded border border-line bg-paper-2 px-3 py-2" placeholder="New book title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <button className="rounded bg-accent px-4 py-2 text-[var(--accent-ink)]" type="submit">Create book</button>
            <label className="cursor-pointer rounded border border-line px-4 py-2">
              Import .docx or .odt
              <input
                type="file"
                accept=".docx,.odt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const html = await fileToHtml(file);
                    const response = await fetch("/api/books", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ title: file.name.replace(/\.(docx|odt)$/i, "") }),
                    });
                    if (!response.ok) throw new Error("The book could not be created.");
                    const payload = await response.json();
                    const imported = applyImportedBlocks(payload.bundle, htmlToImported(html));
                    const saved = await fetch(`/api/books/${payload.bundle.book.id}/sync`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ bundle: imported }),
                    });
                    if (!saved.ok) throw new Error("The import could not be saved.");
                    window.location.href = `/books/${payload.bundle.book.id}/write`;
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : "Import failed.");
                  }
                }}
              />
            </label>
          </form>
          <p className="mt-3 max-w-2xl text-sm text-muted">A .docx or .odt import is read in this browser and kept if it is 50 MB or smaller. Larger files are refused and are not stored. Text before the first chapter stays front matter.</p>
          {error ? <p className="mt-3 text-coral">{error}</p> : null}
          {loading ? <p className="mt-8">Loading the shelf…</p> : null}
          {!loading && books.length === 0 ? <p className="mt-8 text-muted">The shelf is empty. Create a book, or import a manuscript.</p> : null}
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {books.map((book) => (
              <li key={book.id} className="page-sheet p-4">
                <h2 className="font-serif text-2xl">{book.title}</h2>
                <p className="text-sm text-muted">{book.authorName} · {book.wordCount.toLocaleString()} words · {book.role}</p>
                <div className="mt-3 flex gap-3 text-sm">
                  <Link className="underline" href={`/books/${book.id}/write`}>Open</Link>
                  {book.role === "owner" ? (
                    <button type="button" className="text-coral underline" onClick={async () => {
                      await fetch(`/api/books/${book.id}`, { method: "DELETE" });
                      await refresh();
                    }}>Delete</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : status === "loading" ? <p className="mt-10">Loading…</p> : <p className="mt-10">Sign in to open your books.</p>}
    </main>
  );
}
