import { emptyDoc, type JSONContent, uid } from "./model";

export type Suggestion = "insert" | "delete";

export type Inline =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; underline?: boolean; suggestion?: Suggestion }
  | { type: "image"; src: string; alt: string; width: string }
  | { type: "footnote"; text: string }
  | { type: "break" };

export type Block =
  | { type: "p" | "h1" | "h2" | "h3" | "blockquote"; inlines: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "table"; rows: Inline[][][] }
  | { type: "scene" };

type HNode = { tag: string; attrs: Record<string, string>; children: (HNode | string)[] };

const VOID = new Set(["br", "img", "hr", "meta", "input", "wbr"]);

function decode(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function tagName(token: string) {
  const match = token.match(/^<\/?\s*([a-zA-Z0-9]+)/);
  return match ? match[1].toLowerCase() : "";
}

function attrMap(token: string) {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(token))) attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? "");
  return attrs;
}

function parseHtml(html: string): HNode {
  const tokens = html.match(/<\/?[^>]+>|[^<]+/g) ?? [];
  const root: HNode = { tag: "root", attrs: {}, children: [] };
  const stack = [root];
  for (const token of tokens) {
    if (token.startsWith("</")) {
      const name = tagName(token);
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === name) {
          stack.splice(index);
          break;
        }
      }
      continue;
    }
    if (token.startsWith("<")) {
      const tag = tagName(token);
      if (!tag || tag.startsWith("!")) continue;
      const element: HNode = { tag, attrs: attrMap(token), children: [] };
      stack[stack.length - 1].children.push(element);
      if (!VOID.has(tag) && !token.endsWith("/>")) stack.push(element);
      continue;
    }
    const text = decode(token);
    if (text) stack[stack.length - 1].children.push(text);
  }
  return root;
}

function marksOf(node: JSONContent) {
  const marks = new Set((node.marks ?? []).map((mark) => mark.type));
  return {
    bold: marks.has("bold"),
    italic: marks.has("italic"),
    underline: marks.has("underline"),
    suggestion: marks.has("suggestionDelete") ? "delete" : marks.has("suggestionInsert") ? "insert" : undefined,
  } as const;
}

function inlinesFrom(
  nodes: JSONContent[] | undefined,
  inherited: { bold?: boolean; italic?: boolean; underline?: boolean; suggestion?: Suggestion } = {},
): Inline[] {
  const result: Inline[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "text") {
      const marks = marksOf(node);
      result.push({
        type: "text",
        text: node.text ?? "",
        bold: inherited.bold || marks.bold || undefined,
        italic: inherited.italic || marks.italic || undefined,
        underline: inherited.underline || marks.underline || undefined,
        suggestion: marks.suggestion ?? inherited.suggestion,
      });
    } else if (node.type === "hardBreak") {
      result.push({ type: "break" });
    } else if (node.type === "image") {
      result.push({
        type: "image",
        src: String(node.attrs?.src ?? ""),
        alt: String(node.attrs?.alt ?? ""),
        width: String(node.attrs?.width ?? "100%"),
      });
    } else if (node.type === "footnote") {
      result.push({ type: "footnote", text: String(node.attrs?.text ?? "") });
    } else if (node.content) {
      const marks = marksOf(node);
      result.push(
        ...inlinesFrom(node.content, {
          bold: inherited.bold || marks.bold,
          italic: inherited.italic || marks.italic,
          underline: inherited.underline || marks.underline,
          suggestion: marks.suggestion ?? inherited.suggestion,
        }),
      );
    }
  }
  return result.filter((inline) => inline.type !== "text" || inline.text.length > 0);
}

export function docToBlocks(doc: JSONContent | undefined): Block[] {
  const blocks: Block[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "paragraph") blocks.push({ type: "p", inlines: inlinesFrom(node.content) });
    else if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 2);
      const type = level <= 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push({ type, inlines: inlinesFrom(node.content) });
    } else if (node.type === "blockquote") {
      blocks.push({ type: "blockquote", inlines: inlinesFrom(node.content) });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      blocks.push({
        type: node.type === "bulletList" ? "ul" : "ol",
        items: (node.content ?? []).map((item) => inlinesFrom(item.content)),
      });
    } else if (node.type === "table") {
      blocks.push({
        type: "table",
        rows: (node.content ?? []).map((row) => (row.content ?? []).map((cell) => inlinesFrom(cell.content))),
      });
    } else if (node.type === "sceneBreak") blocks.push({ type: "scene" });
    else for (const child of node.content ?? []) walk(child);
  };
  for (const child of doc?.content ?? []) walk(child);
  return blocks;
}

function contentFromInlines(inlines: Inline[]): JSONContent[] {
  const content: JSONContent[] = [];
  for (const inline of inlines) {
    if (inline.type === "break") content.push({ type: "hardBreak" });
    else if (inline.type === "image" && inline.src) {
      content.push({ type: "image", attrs: { src: inline.src, alt: inline.alt, width: inline.width || "100%" } });
    } else if (inline.type === "footnote") {
      content.push({ type: "footnote", attrs: { id: uid(), text: inline.text } });
    } else if (inline.type === "text" && inline.text) {
      const marks: { type: string }[] = [];
      if (inline.bold) marks.push({ type: "bold" });
      if (inline.italic) marks.push({ type: "italic" });
      if (inline.underline) marks.push({ type: "underline" });
      if (inline.suggestion === "insert") marks.push({ type: "suggestionInsert" });
      if (inline.suggestion === "delete") marks.push({ type: "suggestionDelete" });
      content.push(marks.length ? { type: "text", text: inline.text, marks } : { type: "text", text: inline.text });
    }
  }
  return content;
}

export function blocksToDoc(blocks: Block[]): JSONContent {
  const content = blocks.map((block): JSONContent => {
    if (block.type === "scene") return { type: "sceneBreak" };
    if (block.type === "ul" || block.type === "ol") {
      return {
        type: block.type === "ul" ? "bulletList" : "orderedList",
        content: block.items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: contentFromInlines(item) }],
        })),
      };
    }
    if (block.type === "table") {
      return {
        type: "table",
        content: block.rows.map((row, index) => ({
          type: "tableRow",
          content: row.map((cell) => ({
            type: index === 0 ? "tableHeader" : "tableCell",
            content: [{ type: "paragraph", content: contentFromInlines(cell) }],
          })),
        })),
      };
    }
    if (!("inlines" in block)) return { type: "paragraph" };
    if (block.type === "h1" || block.type === "h2" || block.type === "h3") {
      return {
        type: "heading",
        attrs: { level: block.type === "h1" ? 1 : block.type === "h2" ? 2 : 3 },
        content: contentFromInlines(block.inlines),
      };
    }
    if (block.type === "blockquote") {
      return { type: "blockquote", content: [{ type: "paragraph", content: contentFromInlines(block.inlines) }] };
    }
    return { type: "paragraph", content: contentFromInlines(block.inlines) };
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function inlineText(nodes: (HNode | string)[], style: { bold?: boolean; italic?: boolean; underline?: boolean } = {}): Inline[] {
  const inlines: Inline[] = [];
  for (const child of nodes) {
    if (typeof child === "string") {
      if (child) inlines.push({ type: "text", text: child, ...style });
      continue;
    }
    if (child.tag === "br") {
      inlines.push({ type: "break" });
      continue;
    }
    if (child.tag === "img") {
      const src = child.attrs.src || "";
      if (src) inlines.push({ type: "image", src, alt: child.attrs.alt || "", width: child.attrs.width || "100%" });
      continue;
    }
    if (child.tag === "sup" && (child.attrs["data-footnote"] || child.attrs["data-note"])) {
      inlines.push({ type: "footnote", text: child.attrs["data-footnote"] || textOf(child) });
      continue;
    }
    const next = {
      bold: style.bold || child.tag === "strong" || child.tag === "b",
      italic: style.italic || child.tag === "em" || child.tag === "i",
      underline: style.underline || child.tag === "u",
    };
    inlines.push(...inlineText(child.children, next));
  }
  return inlines;
}

function textOf(node: HNode | string): string {
  if (typeof node === "string") return node;
  return node.children.map(textOf).join("");
}

function blocksFromElement(element: HNode): Block[] {
  if (element.tag === "p") return [{ type: "p", inlines: inlineText(element.children) }];
  if (element.tag === "h1" || element.tag === "h2" || element.tag === "h3" || element.tag === "h4") {
    const type = element.tag === "h1" ? "h1" : element.tag === "h2" ? "h2" : "h3";
    return [{ type, inlines: inlineText(element.children) }];
  }
  if (element.tag === "blockquote") return [{ type: "blockquote", inlines: inlineText(element.children) }];
  if (element.tag === "hr") return [{ type: "scene" }];
  if (element.tag === "ul" || element.tag === "ol") {
    const items = element.children
      .filter((child): child is HNode => typeof child !== "string" && child.tag === "li")
      .map((item) => inlineText(item.children));
    return [{ type: element.tag, items }];
  }
  if (element.tag === "table") {
    const rows = element.children
      .flatMap((child) => (typeof child !== "string" && (child.tag === "tbody" || child.tag === "thead" || child.tag === "table") ? child.children : [child]))
      .filter((child): child is HNode => typeof child !== "string" && child.tag === "tr")
      .map((row) =>
        row.children
          .filter((cell): cell is HNode => typeof cell !== "string" && (cell.tag === "td" || cell.tag === "th"))
          .map((cell) => inlineText(cell.children)),
      );
    return rows.length ? [{ type: "table", rows }] : [];
  }
  return element.children.flatMap((child) => (typeof child === "string" ? (child.trim() ? [{ type: "p" as const, inlines: [{ type: "text" as const, text: child }] }] : []) : blocksFromElement(child)));
}

export function htmlToBlocks(html: string): Block[] {
  const root = parseHtml(html);
  return blocksFromElement(root).filter((block) => {
    if (block.type === "scene" || block.type === "table" || block.type === "ul" || block.type === "ol") return true;
    return "inlines" in block && block.inlines.length > 0;
  });
}

export function inlinePlain(inlines: Inline[]) {
  return inlines
    .map((inline) => (inline.type === "text" ? inline.text : inline.type === "break" ? "\n" : inline.type === "footnote" ? "" : ""))
    .join("");
}

export function blocksPlain(blocks: Block[]) {
  return blocks
    .map((block) => {
      if (block.type === "scene") return "\n";
      if (block.type === "ul" || block.type === "ol") return block.items.map((item) => inlinePlain(item)).join("\n");
      if (block.type === "table") return block.rows.map((row) => row.map(inlinePlain).join("\t")).join("\n");
      return "inlines" in block ? inlinePlain(block.inlines) : "";
    })
    .join("\n\n")
    .trim();
}

export function replaceInDoc(doc: JSONContent, find: string, replacement: string, all: boolean): JSONContent {
  if (!find) return doc;
  let remaining = all ? Number.POSITIVE_INFINITY : 1;
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "text" && node.text && remaining > 0 && node.text.includes(find)) {
      if (all) return { ...node, text: node.text.split(find).join(replacement) };
      remaining -= 1;
      return { ...node, text: node.text.replace(find, replacement) };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  };
  return walk(doc);
}

export function emptyDocument() {
  return emptyDoc();
}
