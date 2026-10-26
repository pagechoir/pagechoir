import { htmlToBlocks, type Block } from "./blocks";
import { blocksToDoc } from "./blocks";
import {
  MAX_IMPORT_BYTES,
  emptyDoc,
  now,
  tombstone,
  uid,
  type BookBundle,
  type DocNode,
} from "./model";

export function assertImportFile(file: { name: string; size: number }) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".docx") && !lower.endsWith(".odt")) {
    throw new Error("Import a .docx or .odt file.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("That file is over 50 MB. Split it, or bring in a smaller export, and try again.");
  }
}

function inlineText(block: Block) {
  if (!("inlines" in block)) return "";
  return block.inlines
    .map((inline) => (inline.type === "text" ? inline.text : inline.type === "break" ? " " : ""))
    .join("")
    .trim();
}

export function splitImportedBlocks(blocks: Block[]) {
  const preface: Block[] = [];
  const chapters: { title: string; blocks: Block[] }[] = [];
  let seenChapter = false;
  for (const block of blocks) {
    if (block.type === "h1") {
      seenChapter = true;
      chapters.push({ title: inlineText(block) || "Imported chapter", blocks: [] });
      continue;
    }
    if (!seenChapter) preface.push(block);
    else chapters[chapters.length - 1].blocks.push(block);
  }
  if (!seenChapter) {
    return { preface: [] as Block[], chapters: [{ title: "Imported chapter", blocks }] };
  }
  return { preface, chapters };
}

export function applyImportedBlocks(bundle: BookBundle, blocks: Block[]): BookBundle {
  const next: BookBundle = structuredClone(bundle);
  const { preface, chapters } = splitImportedBlocks(blocks);
  const stamp = now();
  for (const node of next.nodes) {
    if (node.kind === "chapter" || node.kind === "scene" || node.kind === "part") tombstone(next, "node", node.id);
  }
  next.nodes = next.nodes.filter((node) => node.kind !== "chapter" && node.kind !== "scene" && node.kind !== "part");
  const prefaceNode = next.nodes.find((node) => node.matterKey === "preface");
  if (preface.length && prefaceNode) {
    prefaceNode.content = blocksToDoc(preface);
    prefaceNode.included = true;
    prefaceNode.updatedAt = stamp;
  }
  const frontMax = next.nodes.filter((node) => node.kind === "front").reduce((max, node) => Math.max(max, node.order), -1);
  chapters.forEach((chapter, index) => {
    const docNode: DocNode = {
      id: uid(),
      parentId: null,
      kind: "chapter",
      matterKey: "",
      title: chapter.title,
      included: true,
      order: frontMax + 1 + index,
      content: chapter.blocks.length ? blocksToDoc(chapter.blocks) : emptyDoc(),
      updatedAt: stamp,
    };
    next.nodes.push(docNode);
  });
  next.nodes
    .filter((node) => node.kind === "back")
    .sort((a, b) => a.order - b.order)
    .forEach((node, index) => {
      node.order = frontMax + chapters.length + 1 + index;
      node.updatedAt = stamp;
    });
  next.book = { ...next.book, updatedAt: stamp };
  return next;
}

export function htmlToImported(html: string) {
  return htmlToBlocks(html);
}
