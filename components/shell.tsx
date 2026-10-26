"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useBook } from "@/components/book-provider";
import { forgetFolder, folderSupported, mirrorBook, rememberFolder } from "@/lib/client-store";
import { bookMarkdown, buildDocx } from "@/lib/export";
import { canWrite, now, uid, type Role } from "@/lib/model";

const links = [
  ["write", "Write"],
  ["bible/characters", "Bible"],
  ["timeline", "Timeline"],
  ["boards", "Boards"],
  ["goals", "Goals"],
  ["history", "History"],
  ["export", "Export"],
];

function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function BookShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const book = useBook();
  const bundle = book.bundle;
  const [open, setOpen] = useState<"backup" | "people" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [darkOn, setDarkOn] = useState(false);

  useEffect(() => {
    setDarkOn(document.documentElement.classList.contains("dark"));
  }, []);

  if (!bundle) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-lg">{book.error || "Opening the book…"}</p>
      </main>
    );
  }

  const writing = pathname.endsWith("/write");
  const unread = bundle.comments.filter((comment) => !comment.resolved && comment.updatedAt > book.lastCommentSeenAt).length;
  const status =
    book.status === "synced"
      ? `Synced ${book.syncedAt ? new Date(book.syncedAt).toLocaleTimeString() : ""}`.trim()
      : book.status === "local"
        ? `Saved locally ${book.savedAt ? new Date(book.savedAt).toLocaleTimeString() : ""}`.trim()
        : book.status === "offline"
          ? "Saved locally. Sync is waiting."
          : "Opening…";

  async function connectFolder() {
    try {
      await rememberFolder();
      await book.refreshFolder();
      await mirrorBook(bundle!);
      setMessage("Copies will be written into the folder you chose.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The folder was not connected.");
    }
  }

  const backupControls = (
    <div className="flex flex-wrap gap-2 text-sm">
      <button type="button" className="rounded border border-line px-2 py-1" onClick={() => downloadText(`${bundle.book.title}.md`, bookMarkdown(bundle), "text/markdown")}>
        Markdown
      </button>
      <button
        type="button"
        className="rounded border border-line px-2 py-1"
        onClick={async () => {
          const bytes = await buildDocx(bundle);
          const blob = new Blob([bytes as unknown as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${bundle.book.title}.docx`;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        }}
      >
        Word
      </button>
      <button type="button" className="rounded border border-line px-2 py-1" onClick={() => downloadText(`${bundle.book.title}.json`, JSON.stringify(bundle, null, 2), "application/json")}>
        JSON snapshot
      </button>
      {folderSupported() ? (
        book.folderOn ? (
          <button type="button" className="rounded border border-line px-2 py-1" onClick={async () => { await forgetFolder(); await book.refreshFolder(); }}>
            Stop folder copies
          </button>
        ) : (
          <button type="button" className="rounded border border-line px-2 py-1" onClick={() => void connectFolder()}>
            Save copies to a folder
          </button>
        )
      ) : (
        <span className="text-muted">Folder copies are available in Chrome, Edge, and Opera.</span>
      )}
      {message ? <span className="text-muted">{message}</span> : null}
    </div>
  );

  if (writing) {
    return (
      <div className="studio-app">
        <nav className="studio-rail" aria-label="Book">
          {links.map(([href, label]) => {
            const active = pathname.includes(`/${href.split("/")[0]}`);
            return (
              <Link key={href} href={`/books/${bundle.book.id}/${href}`} className={active ? "is-on" : ""} aria-label={label} title={label}>
                <RailIcon name={href.split("/")[0]} />
              </Link>
            );
          })}
          <span className="studio-rail-gap" />
          <button type="button" className={open === "backup" ? "is-on" : ""} aria-label="Download backup" title="Download backup" onClick={() => setOpen(open === "backup" ? null : "backup")}>
            <RailIcon name="backup" />
          </button>
          <button type="button" className={open === "people" ? "is-on" : ""} aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"} title="Inbox" onClick={() => { setOpen(open === "people" ? null : "people"); void book.markCommentsRead(); }}>
            <RailIcon name="inbox" />
            {unread ? <i className="studio-badge" /> : null}
          </button>
          <button type="button" className={open === "share" ? "is-on" : ""} aria-label="Share" title="Share" onClick={() => setOpen(open === "share" ? null : "share")}>
            <RailIcon name="share" />
          </button>
          <button type="button" className={darkOn ? "is-on" : ""} aria-label="Theme" title="Theme" onClick={() => {
            const dark = !document.documentElement.classList.contains("dark");
            document.documentElement.classList.toggle("dark", dark);
            localStorage.setItem("pagechoir-theme", dark ? "dark" : "light");
            setDarkOn(dark);
          }}>
            <RailIcon name="theme" />
          </button>
          <Link href="/account" aria-label="Account" title="Account"><RailIcon name="account" /></Link>
        </nav>
        {open ? (
          <div className="studio-flyout">
            <header>
              <strong>{open === "backup" ? "Download backup" : open === "people" ? "Inbox" : "Share"}</strong>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </header>
            {open === "backup" ? backupControls : null}
            {open === "people" ? <PeoplePanel /> : null}
            {open === "share" ? <SharePanel /> : null}
          </div>
        ) : null}
        <div className="studio-main">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-[color:var(--paper)]/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="font-serif text-xl tracking-tight">
            Pagechoir
          </Link>
          <strong className="truncate">{bundle.book.title}</strong>
          <span className="text-sm text-muted">{book.wordCount.toLocaleString()} words</span>
          <span className="text-sm text-muted">{status}</span>
          <nav className="flex flex-wrap gap-1">
            {links.map(([href, label]) => {
              const active = pathname.includes(`/${href.split("/")[0]}`);
              return (
                <Link key={href} href={`/books/${bundle.book.id}/${href}`} className={`rounded-full px-3 py-1 text-sm ${active ? "bg-accent text-[var(--accent-ink)]" : "hover:bg-sidebar"}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => setOpen(open === "backup" ? null : "backup")}>
              Download backup
            </button>
            <button type="button" className="relative rounded-full border border-line px-3 py-1 text-sm" onClick={() => { setOpen(open === "people" ? null : "people"); void book.markCommentsRead(); }}>
              Inbox{unread ? ` (${unread})` : ""}
            </button>
            <button type="button" className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => setOpen(open === "share" ? null : "share")}>
              Share
            </button>
            <ThemeToggle />
            <Link href="/account" className="text-sm underline">
              Account
            </Link>
          </div>
        </div>
        {book.error ? <p className="px-4 pb-2 text-sm text-coral">{book.error}</p> : null}
        {open === "backup" ? <div className="border-t border-line px-4 py-3">{backupControls}</div> : null}
        {open === "people" ? <PeoplePanel /> : null}
        {open === "share" ? <SharePanel /> : null}
      </header>
      <div>{children}</div>
    </div>
  );
}

function RailIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "write") return <svg {...common}><path d="M6 4h9l3 3v13H6z" /><path d="M15 4v4h4" /></svg>;
  if (name === "bible") return <svg {...common}><path d="M5 5h6a3 3 0 0 1 3 3v11H8a3 3 0 0 0-3 3z" /><path d="M19 5h-6a3 3 0 0 0-3 3v11h6a3 3 0 0 1 3 3z" /></svg>;
  if (name === "timeline") return <svg {...common}><path d="M4 12h16" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" /></svg>;
  if (name === "boards") return <svg {...common}><path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" /></svg>;
  if (name === "goals") return <svg {...common}><path d="M5 19V9M12 19V5M19 19v-7" /></svg>;
  if (name === "history") return <svg {...common}><path d="M4 12a8 8 0 1 0 2-5" /><path d="M4 4v4h4M12 8v5l3 2" /></svg>;
  if (name === "export") return <svg {...common}><path d="M12 4v10M8 10l4 4 4-4M5 19h14" /></svg>;
  if (name === "backup") return <svg {...common}><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 19h14" /></svg>;
  if (name === "inbox") return <svg {...common}><path d="M4 6h16v12H4zM4 13h5l2 2h2l2-2h5" /></svg>;
  if (name === "share") return <svg {...common}><circle cx="7" cy="12" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 11l6-3M9 13l6 3" /></svg>;
  if (name === "theme") return <svg {...common}><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6" /><circle cx="12" cy="12" r="3" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 3.5-4 7-4s5.5 1 7 4" /></svg>;
}

function PeoplePanel() {
  const { bundle, update, role } = useBook();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "owner">>("coauthor");
  if (!bundle) return null;
  return (
    <div className="border-t border-line px-4 py-3 text-sm">
      <div className="mb-3 space-y-2">
        {bundle.comments.length === 0 ? <p className="text-muted">No comments yet.</p> : null}
        {bundle.comments
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((comment) => (
            <article key={comment.id} className="rounded border border-line bg-paper-2 p-2">
              <p className="text-muted">
                {comment.authorName} · {comment.resolved ? "Resolved" : "Open"}
                {comment.quote ? ` · “${comment.quote}”` : ""}
              </p>
              <p>{comment.body}</p>
              {canWrite(role) ? (
                <button
                  type="button"
                  className="mt-1 underline"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      comments: current.comments.map((item) => (item.id === comment.id ? { ...item, resolved: !item.resolved, updatedAt: now() } : item)),
                    }))
                  }
                >
                  {comment.resolved ? "Reopen" : "Resolve"}
                </button>
              ) : null}
            </article>
          ))}
      </div>
      {role === "owner" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.includes("@")) return;
            update((current) => ({
              ...current,
              collaborators: [
                ...current.collaborators,
                { id: uid(), email: email.trim().toLowerCase(), userId: null, role: inviteRole, status: "pending", updatedAt: now() },
              ],
            }));
            setEmail("");
          }}
        >
          <input className="rounded border border-line bg-paper-2 px-2 py-1" placeholder="Editor email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <select className="rounded border border-line bg-paper-2 px-2 py-1" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<Role, "owner">)}>
            <option value="coauthor">Co-author</option>
            <option value="commenter">Commenter</option>
            <option value="reader">Reader</option>
          </select>
          <button className="rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">
            Invite
          </button>
        </form>
      ) : null}
      <ul className="mt-2 space-y-1">
        {bundle.collaborators.map((person) => (
          <li key={person.id}>
            {person.email} · {person.role} · {person.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SharePanel() {
  const { bundle, update, role } = useBook();
  const [nodeId, setNodeId] = useState("");
  const [shareRole, setShareRole] = useState<"reader" | "commenter">("reader");
  if (!bundle || !canWrite(role)) return <p className="border-t border-line px-4 py-3 text-sm text-muted">Only editors can create preview links.</p>;
  return (
    <div className="border-t border-line px-4 py-3 text-sm">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          update((current) => ({
            ...current,
            shares: [...current.shares, { id: uid(), token: uid().replaceAll("-", ""), nodeId: nodeId || null, role: shareRole, updatedAt: now() }],
          }));
        }}
      >
        <select className="rounded border border-line bg-paper-2 px-2 py-1" value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
          <option value="">Whole book</option>
          {bundle.nodes
            .filter((node) => node.kind === "chapter")
            .map((node) => (
              <option key={node.id} value={node.id}>
                {node.title}
              </option>
            ))}
        </select>
        <select className="rounded border border-line bg-paper-2 px-2 py-1" value={shareRole} onChange={(event) => setShareRole(event.target.value as "reader" | "commenter")}>
          <option value="reader">Reader</option>
          <option value="commenter">Commenter</option>
        </select>
        <button className="rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">
          Create link
        </button>
      </form>
      <ul className="mt-2 space-y-1">
        {bundle.shares.map((share) => (
          <li key={share.id} className="flex flex-wrap items-center gap-2">
            <code className="truncate">{`/share/${share.token}`}</code>
            <button type="button" className="underline" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/share/${share.token}`)}>
              Copy
            </button>
            <button
              type="button"
              className="underline"
              onClick={() =>
                update((current) => ({
                  ...current,
                  shares: current.shares.filter((item) => item.id !== share.id),
                  tombstones: [...current.tombstones, { type: "share", id: share.id, at: now() }],
                }))
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
