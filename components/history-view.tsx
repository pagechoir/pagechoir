"use client";

import { useEffect, useState } from "react";
import { useBook } from "@/components/book-provider";
import { canWrite, restoreBundle } from "@/lib/model";

type VersionRow = { id: string; name: string; auto: boolean; createdAt: string };

export function HistoryView() {
  const { bundle, update, role } = useBook();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const bookId = bundle?.book.id;

  async function refresh() {
    if (!bookId) return;
    const response = await fetch(`/api/books/${bookId}/versions`);
    if (!response.ok) return;
    const payload = await response.json();
    setVersions(payload.versions);
  }

  useEffect(() => {
    void refresh();
  }, [bookId]);

  if (!bundle || !bookId) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-3xl">History</h1>
      <p className="mt-2 text-sm text-muted">Named versions stay. An automatic snapshot is also saved while you write, and before an import or a restore.</p>
      {canWrite(role) ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await fetch(`/api/books/${bookId}/versions`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: name.trim() || "Named version", auto: false, snapshot: bundle }),
            });
            if (!response.ok) {
              setMessage("The version could not be saved.");
              return;
            }
            setName("");
            setMessage("Version saved.");
            await refresh();
          }}
        >
          <input className="flex-1 rounded border border-line bg-paper-2 px-2 py-1" placeholder="Name this version" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">Save version</button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
      <ul className="mt-4 space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="page-sheet flex items-center justify-between p-3 text-sm">
            <span>
              <strong>{version.name}</strong>
              <span className="text-muted"> · {new Date(version.createdAt).toLocaleString()} {version.auto ? "· auto" : ""}</span>
            </span>
            {canWrite(role) ? (
              <button
                type="button"
                className="underline"
                onClick={async () => {
                  await fetch(`/api/books/${bookId}/versions`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name: `Before restore ${new Date().toLocaleString()}`, auto: true, snapshot: bundle }),
                  });
                  const response = await fetch(`/api/books/${bookId}/versions/${version.id}`);
                  if (!response.ok) return;
                  const payload = await response.json();
                  update((current) => restoreBundle(current, payload.version.snapshot));
                  setMessage("Restored. The previous copy was kept as a version.");
                  await refresh();
                }}
              >
                Restore
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
