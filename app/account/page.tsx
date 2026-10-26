"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetFolder, folderSupported, hasFolder, rememberFolder, requestPersistentStorage } from "@/lib/client-store";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<{ id: string; createdAt: string; userAgent: string }[]>([]);
  const [folder, setFolder] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/account")
      .then((response) => response.json())
      .then((payload) => {
        setEmail(payload.user?.email ?? "");
        setName(payload.user?.name ?? "");
        setSessions(payload.sessions ?? []);
      });
    void hasFolder().then(setFolder);
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm underline">Back to the shelf</Link>
      <h1 className="mt-4 font-serif text-4xl">Account</h1>
      <p className="mt-2">{name} · {email}</p>
      <section className="mt-6 space-y-2">
        <h2 className="font-semibold">Copies of your work</h2>
        <p className="text-sm text-muted">Every edit is committed in this browser before it syncs. Persistent storage asks the browser not to clear that copy.</p>
        <p className="text-sm">Persistent storage: {persisted ? "granted" : "not granted yet"}</p>
        <button type="button" className="rounded border border-line px-3 py-1 text-sm" onClick={async () => setPersisted(await requestPersistentStorage())}>
          Ask the browser to keep local copies
        </button>
        {folderSupported() ? (
          <button
            type="button"
            className="ml-2 rounded border border-line px-3 py-1 text-sm"
            onClick={async () => {
              try {
                if (folder) {
                  await forgetFolder();
                  setFolder(false);
                } else {
                  await rememberFolder();
                  setFolder(true);
                  setMessage("Folder connected. Open a book and it will keep snapshots there.");
                }
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "The folder could not be connected.");
              }
            }}
          >
            {folder ? "Disconnect folder" : "Connect a folder"}
          </button>
        ) : (
          <p className="text-sm text-muted">Chrome, Edge, and Opera can write snapshots to a folder you choose. Firefox and Safari keep the browser copy and the server copy.</p>
        )}
        {message ? <p className="text-sm">{message}</p> : null}
      </section>
      <section className="mt-8">
        <h2 className="font-semibold">Sign-ins</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {sessions.map((session) => (
            <li key={session.id} className="rounded border border-line p-2">
              {new Date(session.createdAt).toLocaleString()}
              <span className="block text-muted">{session.userAgent}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
