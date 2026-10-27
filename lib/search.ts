import type { Node as ProseNode } from "@tiptap/pm/model";

function foldChar(char: string) {
  if (char === "\u2019" || char === "\u2018" || char === "`") return "'";
  if (char === "\u201C" || char === "\u201D") return '"';
  if (char === "\uFF1F") return "?";
  const lower = char.toLowerCase();
  return lower.length === 1 ? lower : char;
}

function fold(value: string) {
  let out = "";
  for (const char of value) out += foldChar(char);
  return out;
}

function blockPieces(block: ProseNode, blockPos: number) {
  let raw = "";
  const map: number[] = [];
  block.descendants((child, rel) => {
    if (!child.isText || !child.text) return;
    const base = blockPos + 1 + rel;
    for (let index = 0; index < child.text.length; index += 1) {
      raw += child.text[index];
      map.push(base + index);
    }
  });
  return { raw, map };
}

export function findRanges(doc: ProseNode, needle: string) {
  const wanted = fold(needle.trim());
  const found: { from: number; to: number }[] = [];
  if (!wanted) return found;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const { raw, map } = blockPieces(node, pos);
    const folded = fold(raw);
    let start = 0;
    while (start < folded.length) {
      const at = folded.indexOf(wanted, start);
      if (at < 0) break;
      const end = at + wanted.length - 1;
      if (map[at] != null && map[end] != null) found.push({ from: map[at], to: map[end] + 1 });
      start = at + Math.max(wanted.length, 1);
    }
  });
  return found;
}
