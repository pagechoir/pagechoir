import JSZip from "jszip";
import { assertImportFile } from "./import-book";

function innerText(xml: string) {
  return xml
    .replace(/<text:line-break\/>/g, "<br/>")
    .replace(/<text:s[^/]*\/>/g, " ")
    .replace(/<text:tab[^/]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export async function odtToHtml(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("That ODT file has no readable text.");
  const chunks: string[] = [];
  const pattern = /<text:(h|p)\b([^>]*)>([\s\S]*?)<\/text:\1>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const kind = match[1];
    const attrs = match[2];
    const text = innerText(match[3]).trim();
    if (!text) continue;
    if (kind === "h") {
      const level = /text:outline-level="(\d+)"/.exec(attrs)?.[1] ?? "1";
      const tag = level === "1" ? "h1" : level === "2" ? "h2" : "h3";
      chunks.push(`<${tag}>${text}</${tag}>`);
    } else chunks.push(`<p>${text}</p>`);
  }
  if (!chunks.length) throw new Error("That ODT file did not contain any paragraphs.");
  return chunks.join("");
}

export async function fileToHtml(file: File) {
  assertImportFile(file);
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".odt")) return odtToHtml(buffer);
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        return { src: `data:${image.contentType};base64,${base64}` };
      }),
    },
  );
  if (!result.value.trim()) throw new Error("That document did not contain any readable text.");
  return result.value;
}
