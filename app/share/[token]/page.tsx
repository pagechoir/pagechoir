"use client";

import { use, useEffect, useState } from "react";
import { plainTextFromDoc, type DocNode, type JSONContent } from "@/lib/model";

type Payload = {
  role: "reader" | "commenter";
  book: { title: string; subtitle: string; authorName: string };
  nodes: DocNode[];
  comments: { id: string; nodeId: string; authorName: string; body: string; quote: string }[];
  error?: string;
};

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("Reader");
  const [body, setBody] = useState("");
  const [nodeId, setNodeId] = useState("");

  useEffect(() => {
    void fetch(`/api/share/${token}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) {
          setError(json.error || "This preview is not available.");
          return;
        }
        setPayload(json);
        const first = json.nodes?.find((node: DocNode) => node.kind === "chapter");
        if (first) setNodeId(first.id);
      })
      .catch(() => setError("This preview is not available."));
  }, [token]);

  if (error) return <main className="mx-auto max-w-xl px-6 py-16">{error}</main>;
  if (!payload) return <main className="mx-auto max-w-xl px-6 py-16">Opening the preview…</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm uppercase tracking-[0.18em] text-accent">Pagechoir preview</p>
      <h1 className="font-serif text-4xl">{payload.book.title}</h1>
      <p className="text-muted">{payload.book.authorName}</p>
      {payload.nodes
        .filter((node) => node.included !== false && node.kind !== "scene")
        .map((node) => (
          <article key={node.id} className="page-sheet mt-6 px-8 py-8">
            <h2 className="font-serif text-2xl">{node.matterKey === "title" ? payload.book.title : node.title}</h2>
            <div className="mt-4 whitespace-pre-wrap font-serif leading-7">{plainTextFromDoc(node.content as JSONContent)}</div>
          </article>
        ))}
      {payload.role === "commenter" ? (
        <form
          className="mt-6 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await fetch(`/api/share/${token}/comments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ body, authorName: name, nodeId, quote: "" }),
            });
            const json = await response.json();
            if (!response.ok) {
              setError(json.error || "The comment could not be sent.");
              return;
            }
            setPayload({ ...payload, comments: [...payload.comments, json.comment] });
            setBody("");
          }}
        >
          <h2 className="font-semibold">Leave a comment</h2>
          <input className="w-full rounded border border-line bg-paper-2 px-2 py-1" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="w-full rounded border border-line bg-paper-2 px-2 py-1" value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
            {payload.nodes.filter((node) => node.kind === "chapter").map((node) => (
              <option key={node.id} value={node.id}>{node.title}</option>
            ))}
          </select>
          <textarea className="w-full rounded border border-line bg-paper-2 p-2" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
          <button className="rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">Send</button>
        </form>
      ) : null}
      {payload.comments?.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {payload.comments.map((comment) => (
            <li key={comment.id} className="rounded border border-line p-2">
              <strong>{comment.authorName}</strong> {comment.body}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
