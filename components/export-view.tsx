"use client";

import { useEffect, useState } from "react";
import { useBook } from "@/components/book-provider";
import { bookBodyHtml, bookMarkdown, buildDocx, buildEpub, buildPdf, previewCss } from "@/lib/export";
import { canWrite, now, trimInches, type BookSettings } from "@/lib/model";

function saveBytes(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function ExportView() {
  const { bundle, update, role } = useBook();
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const settings = bundle?.book.settings;

  useEffect(() => {
    if (!bundle) return;
    setPreview(`<style>${previewCss(bundle.book.settings)}</style>${bookBodyHtml(bundle)}`);
  }, [bundle]);

  if (!bundle || !settings) return null;
  const editing = canWrite(role);
  const [width, height] = trimInches(settings);

  function patch(partial: Partial<BookSettings>) {
    update((book) => ({ ...book, book: { ...book.book, updatedAt: now(), settings: { ...book.book.settings, ...partial } } }));
  }

  return (
    <div className="grid gap-4 px-4 py-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <form className="space-y-3 text-sm" onSubmit={(event) => event.preventDefault()}>
        <h1 className="font-serif text-3xl">Export</h1>
        <label className="block">Theme
          <select className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" disabled={!editing} value={settings.theme} onChange={(event) => patch({ theme: event.target.value as BookSettings["theme"] })}>
            <option value="modern">Modern</option>
            <option value="classic">Classic</option>
            <option value="ornament">Ornament</option>
          </select>
        </label>
        <label className="block">Trim
          <select className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" disabled={!editing} value={settings.trim} onChange={(event) => patch({ trim: event.target.value as BookSettings["trim"] })}>
            <option value="trade">Trade 6 × 9</option>
            <option value="digest">Digest 5.5 × 8.5</option>
            <option value="standard">5 × 8</option>
            <option value="pocket">Pocket 4.25 × 6.87</option>
            <option value="a5">A5</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {settings.trim === "custom" ? (
          <div className="flex gap-2">
            <input type="number" step="0.01" className="w-full rounded border border-line px-2 py-1" value={settings.customWidth} onChange={(event) => patch({ customWidth: Number(event.target.value) })} />
            <input type="number" step="0.01" className="w-full rounded border border-line px-2 py-1" value={settings.customHeight} onChange={(event) => patch({ customHeight: Number(event.target.value) })} />
          </div>
        ) : null}
        <p className="text-muted">Page size {width} × {height} in.</p>
        {(["marginTop", "marginBottom", "marginInner", "marginOuter"] as const).map((key) => (
          <label key={key} className="block">{key}
            <input type="number" step="0.05" className="mt-1 w-full rounded border border-line px-2 py-1" value={settings[key]} disabled={!editing} onChange={(event) => patch({ [key]: Number(event.target.value) })} />
          </label>
        ))}
        <label className="block">Scene break
          <input className="mt-1 w-full rounded border border-line px-2 py-1" value={settings.sceneBreak} disabled={!editing} onChange={(event) => patch({ sceneBreak: event.target.value })} />
        </label>
        <label className="block">Scene ornament image
          <input type="file" accept="image/*" className="mt-1 block" disabled={!editing} onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => patch({ sceneBreakImage: String(reader.result) });
            reader.readAsDataURL(file);
          }} />
        </label>
        <label className="block">Cover image
          <input type="file" accept="image/*" className="mt-1 block" disabled={!editing} onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => patch({ coverImage: String(reader.result) });
            reader.readAsDataURL(file);
          }} />
        </label>
        {([
          ["dropCap", "Drop cap"],
          ["chapterNumbers", "Chapter numbers"],
          ["runningHeads", "Running heads"],
          ["blankVerso", "Blank verso pages"],
          ["includeToc", "Table of contents"],
        ] as const).map(([key, label]) => (
          <label key={key} className="block">
            <input type="checkbox" className="mr-2" checked={settings[key]} disabled={!editing} onChange={(event) => patch({ [key]: event.target.checked })} />
            {label}
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border border-line px-3 py-1" onClick={() => {
            const blob = new Blob([bookMarkdown(bundle)], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${bundle.book.title}.md`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
          }}>Markdown</button>
          <button type="button" className="rounded border border-line px-3 py-1" onClick={async () => saveBytes(await buildDocx(bundle), `${bundle.book.title}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}>Word</button>
          <button type="button" className="rounded border border-line px-3 py-1" onClick={async () => saveBytes(await buildEpub(bundle), `${bundle.book.title}.epub`, "application/epub+zip")}>EPUB</button>
          <button type="button" className="rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" onClick={async () => {
            try {
              saveBytes(await buildPdf(bundle), `${bundle.book.title}.pdf`, "application/pdf");
              setMessage("PDF downloaded.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "The PDF could not be built.");
            }
          }}>PDF</button>
        </div>
        {message ? <p>{message}</p> : null}
      </form>
      <iframe title="Typeset preview" className="min-h-[80vh] w-full rounded border border-line bg-white" srcDoc={preview} />
    </div>
  );
}
