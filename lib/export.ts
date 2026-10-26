import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from "docx";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { inlinePlain, type Block, type Inline } from "./blocks";
import { trimInches, type BookBundle, type BookSettings } from "./model";
import { includedSpine, type SpineItem } from "./spine";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function winAnsi(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\u0020-\u00ff]/g, "");
}

function prose(block: Block): Inline[] {
  return "inlines" in block ? block.inlines : [];
}

function renderInlines(inlines: Inline[], footnotes: string[]) {
  return inlines
    .map((inline) => {
      if (inline.type === "break") return "<br/>";
      if (inline.type === "image" && inline.src) {
        return `<img src="${escapeHtml(inline.src)}" alt="${escapeHtml(inline.alt)}" style="width:${escapeHtml(inline.width || "100%")}"/>`;
      }
      if (inline.type === "footnote") {
        footnotes.push(inline.text);
        return `<sup class="note">${footnotes.length}</sup>`;
      }
      if (inline.type !== "text") return "";
      let text = escapeHtml(inline.text);
      if (inline.suggestion === "delete") text = `<del>${text}</del>`;
      if (inline.suggestion === "insert") text = `<ins>${text}</ins>`;
      if (inline.bold) text = `<strong>${text}</strong>`;
      if (inline.italic) text = `<em>${text}</em>`;
      if (inline.underline) text = `<u>${text}</u>`;
      return text;
    })
    .join("");
}

function renderBlocks(blocks: Block[], dropCap: boolean) {
  const footnotes: string[] = [];
  let first = dropCap;
  const html = blocks
    .map((block) => {
      if (block.type === "scene") return `<p class="scene"></p>`;
      if (block.type === "ul" || block.type === "ol") {
        const tag = block.type;
        return `<${tag}>${block.items.map((item) => `<li>${renderInlines(item, footnotes)}</li>`).join("")}</${tag}>`;
      }
      if (block.type === "table") {
        return `<table>${block.rows
          .map(
            (row, index) =>
              `<tr>${row
                .map((cell) => `<${index === 0 ? "th" : "td"}>${renderInlines(cell, footnotes)}</${index === 0 ? "th" : "td"}>`)
                .join("")}</tr>`,
          )
          .join("")}</table>`;
      }
      const inner = renderInlines(prose(block), footnotes);
      if (block.type === "h2") return `<h2>${inner}</h2>`;
      if (block.type === "h3" || block.type === "h1") return `<h3>${inner}</h3>`;
      if (block.type === "blockquote") return `<blockquote>${inner}</blockquote>`;
      const drop = first && inner ? " drop" : "";
      first = false;
      return `<p class="${drop.trim()}">${inner}</p>`;
    })
    .join("\n");
  const notes = footnotes.length
    ? `<ol class="notes">${footnotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ol>`
    : "";
  return html + notes;
}

export function previewCss(settings: BookSettings) {
  const [width, height] = trimInches(settings);
  const font =
    settings.theme === "modern"
      ? '"Source Sans 3", "Segoe UI", sans-serif'
      : settings.theme === "ornament"
        ? '"Cormorant Garamond", Georgia, serif'
        : '"Libre Baskerville", Georgia, serif';
  const scene = settings.sceneBreakImage
    ? `content: ""; background: url("${settings.sceneBreakImage}") center / contain no-repeat;`
    : `content: "${settings.sceneBreak || "*"}";`;
  return `
    @page { size: ${width}in ${height}in; margin: ${settings.marginTop}in ${settings.marginOuter}in ${settings.marginBottom}in ${settings.marginInner}in; }
    body { font-family: ${font}; color: #221c16; line-height: 1.55; }
    h1, h2.chapter { font-weight: 500; text-align: center; string-set: chapter content(text); }
    h1 { font-size: 1.6rem; margin: 2.2rem 0 1rem; }
    .kicker { text-align: center; letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.78rem; }
    .ornament h1 { font-style: italic; }
    p { margin: 0 0 0.2rem; text-indent: 1.15em; }
    p.drop, h1 + p, .kicker + h1 + p, h2 + p { text-indent: 0; }
    p.drop::first-letter { float: left; font-size: 3.1rem; line-height: 0.8; padding-right: 0.35rem; font-weight: 600; }
    blockquote { margin: 0.8rem 1.2rem; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 0.8rem 0; }
    td, th { border: 1px solid #c9bba8; padding: 0.3rem 0.4rem; text-indent: 0; vertical-align: top; }
    img { max-width: 100%; height: auto; }
    .scene { text-align: center; text-indent: 0; margin: 1rem 0; }
    .scene::before { ${scene} }
    .blank { break-after: page; height: 1px; }
    .sheet { break-before: page; }
    .title-page { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
    .title-page h1 { font-size: 2.4rem; }
    ol.notes { font-size: 0.85rem; margin-top: 2rem; }
    ${settings.runningHeads ? `@page { @top-center { content: string(chapter); font-size: 9pt; } @bottom-center { content: counter(page); font-size: 9pt; } }` : ""}
  `;
}

export function bookBodyHtml(bundle: BookBundle) {
  const settings = bundle.book.settings;
  const parts: string[] = [];
  parts.push(
    `<section class="title-page ${settings.theme}"><p class="kicker">${escapeHtml(bundle.book.authorName)}</p><h1>${escapeHtml(bundle.book.title)}</h1>${bundle.book.subtitle ? `<p class="subtitle">${escapeHtml(bundle.book.subtitle)}</p>` : ""}</section>`,
  );
  if (settings.blankVerso) parts.push(`<div class="blank"></div>`);
  if (settings.includeToc) {
    const entries = includedSpine(bundle).filter((item) => item.role === "chapter" || item.role === "part" || item.role === "back");
    parts.push(
      `<section class="sheet"><h1>Contents</h1><ol class="toc">${entries
        .map((item) => `<li>${escapeHtml(item.title)}</li>`)
        .join("")}</ol></section>`,
    );
  }
  for (const item of includedSpine(bundle)) {
    if (item.role === "title") continue;
    const kicker =
      item.role === "chapter" && settings.chapterNumbers && item.chapterNumber
        ? `<p class="kicker">Chapter ${item.chapterNumber}</p>`
        : "";
    parts.push(
      `<section class="sheet ${settings.theme}">${kicker}<h1>${escapeHtml(item.title)}</h1>${renderBlocks(item.blocks, item.role === "chapter" && settings.dropCap).replaceAll("&#10022;", escapeHtml(settings.sceneBreak || "*"))}</section>`,
    );
  }
  return parts.join("\n");
}

export function bookMarkdown(bundle: BookBundle) {
  const lines = [`# ${bundle.book.title}`, "", bundle.book.authorName, ""];
  if (bundle.book.subtitle) lines.push(`*${bundle.book.subtitle}*`, "");
  for (const item of includedSpine(bundle)) {
    if (item.role === "title") continue;
    lines.push(`## ${item.title}`, "");
    lines.push(blocksToMarkdown(item.blocks, bundle.book.settings.sceneBreak), "");
  }
  return lines.join("\n").trim() + "\n";
}

function blocksToMarkdown(blocks: Block[], scene: string) {
  return blocks
    .map((block) => {
      if (block.type === "scene") return scene || "* * *";
      if (block.type === "h2") return `### ${inlinePlain(prose(block))}`;
      if (block.type === "h3" || block.type === "h1") return `#### ${inlinePlain(prose(block))}`;
      if (block.type === "blockquote") return `> ${inlinePlain(prose(block))}`;
      if (block.type === "ul") return block.items.map((item) => `- ${inlinePlain(item)}`).join("\n");
      if (block.type === "ol") return block.items.map((item, index) => `${index + 1}. ${inlinePlain(item)}`).join("\n");
      if (block.type === "table") return block.rows.map((row) => `| ${row.map((cell) => inlinePlain(cell)).join(" | ")} |`).join("\n");
      return inlinePlain(prose(block));
    })
    .join("\n\n");
}

function dataImage(src: string) {
  const match = src.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const binary = atob(match[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, type: match[1] === "png" ? "png" : "jpg" } as const;
}

function runs(inlines: Inline[]) {
  const children: unknown[] = [];
  for (const inline of inlines) {
    if (inline.type === "break") children.push(new TextRun({ break: 1 }));
    else if (inline.type === "footnote") children.push(new TextRun({ superScript: true, text: ` [${inline.text}]` }));
    else if (inline.type === "image") {
      const image = dataImage(inline.src);
      if (!image) continue;
      children.push(
        new ImageRun({
          type: image.type,
          data: image.bytes,
          transformation: { width: inline.width === "40%" ? 180 : inline.width === "70%" ? 320 : 460, height: 240 },
        }),
      );
    } else if (inline.type === "text") {
      children.push(
        new TextRun({
          text: inline.text,
          bold: inline.bold,
          italics: inline.italic,
          underline: inline.underline ? {} : undefined,
          strike: inline.suggestion === "delete",
        }),
      );
    }
  }
  return children as [];
}

export async function buildDocx(bundle: BookBundle) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(bundle.book.title)] }),
    new Paragraph({ children: [new TextRun({ text: bundle.book.authorName, italics: true })] }),
  ];
  for (const item of includedSpine(bundle)) {
    if (item.role === "title") continue;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(item.title)] }));
    for (const block of item.blocks) {
      if (block.type === "scene") {
        children.push(new Paragraph({ alignment: "center", children: [new TextRun(bundle.book.settings.sceneBreak || "*")] }));
        continue;
      }
      if (block.type === "table") {
        children.push(
          new Table({
            rows: block.rows.map(
              (row) =>
                new TableRow({
                  children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: runs(cell) })] })),
                }),
            ),
          }),
        );
        continue;
      }
      if (block.type === "ul" || block.type === "ol") {
        block.items.forEach((itemInlines, index) => {
          children.push(
            new Paragraph({
              children: [new TextRun(`${block.type === "ol" ? `${index + 1}. ` : "• "}`), ...runs(itemInlines)],
            }),
          );
        });
        continue;
      }
      children.push(
        new Paragraph({
          heading: block.type === "h2" ? HeadingLevel.HEADING_2 : block.type === "h3" ? HeadingLevel.HEADING_3 : undefined,
          children: runs(prose(block)),
        }),
      );
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildEpub(bundle: BookBundle) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")?.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const oebps = zip.folder("OEBPS");
  if (!oebps) throw new Error("Could not build the EPUB.");
  oebps.file("style.css", previewCss(bundle.book.settings));
  const manifest: string[] = [`<item id="css" href="style.css" media-type="text/css"/>`, `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`];
  const spine: string[] = [];
  const nav: string[] = [];
  const items = includedSpine(bundle).filter((item) => item.role !== "title");
  const pages: SpineItem[] = [
    {
      id: "title",
      role: "title",
      title: bundle.book.title,
      blocks: [],
      chapterNumber: null,
      included: true,
    },
    ...items,
  ];
  pages.forEach((item, index) => {
    const href = `chap${index}.xhtml`;
    const body =
      item.role === "title"
        ? `<section class="title-page"><p class="kicker">${escapeHtml(bundle.book.authorName)}</p><h1>${escapeHtml(bundle.book.title)}</h1></section>`
        : `<h1>${escapeHtml(item.title)}</h1>${renderBlocks(item.blocks, item.role === "chapter" && bundle.book.settings.dropCap)}`;
    oebps.file(
      href,
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(item.title)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`,
    );
    manifest.push(`<item id="chap${index}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="chap${index}"/>`);
    nav.push(`<li><a href="${href}">${escapeHtml(item.title)}</a></li>`);
  });
  const cover = dataImage(bundle.book.settings.coverImage);
  let coverMeta = "";
  if (cover) {
    oebps.file(`cover.${cover.type === "png" ? "png" : "jpg"}`, cover.bytes);
    manifest.push(
      `<item id="cover" href="cover.${cover.type === "png" ? "png" : "jpg"}" media-type="${cover.type === "png" ? "image/png" : "image/jpeg"}" properties="cover-image"/>`,
    );
    coverMeta = `<meta name="cover" content="cover"/>`;
  }
  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${nav.join("")}</ol></nav></body></html>`,
  );
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${bundle.book.id}</dc:identifier><dc:title>${escapeHtml(bundle.book.title)}</dc:title><dc:creator>${escapeHtml(bundle.book.authorName)}</dc:creator><dc:language>en</dc:language>${coverMeta}</metadata><manifest>${manifest.join("")}</manifest><spine>${spine.join("")}</spine></package>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

function clip(text: string, font: PDFFont, size: number, width: number) {
  const safe = winAnsi(text);
  if (font.widthOfTextAtSize(safe, size) <= width) return safe;
  let clipped = safe;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > width) clipped = clipped.slice(0, -1);
  return `${clipped}...`;
}

export async function buildPdf(bundle: BookBundle) {
  const pdf = await PDFDocument.create();
  const modern = bundle.book.settings.theme === "modern";
  const font = await pdf.embedFont(modern ? StandardFonts.Helvetica : StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(modern ? StandardFonts.HelveticaBold : StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(modern ? StandardFonts.HelveticaOblique : StandardFonts.TimesRomanItalic);
  const settings = bundle.book.settings;
  const [widthIn, heightIn] = trimInches(settings);
  const pageWidth = widthIn * 72;
  const pageHeight = heightIn * 72;
  const marginTop = Math.max(36, settings.marginTop * 72);
  const marginBottom = Math.max(36, settings.marginBottom * 72);
  const marginInner = Math.max(36, settings.marginInner * 72);
  const marginOuter = Math.max(36, settings.marginOuter * 72);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let pageIndex = 0;
  let y = pageHeight * 0.64;
  let chapterTitle = bundle.book.title;

  const contentWidth = () => pageWidth - marginInner - marginOuter;
  const marginLeft = () => ((pageIndex + 1) % 2 === 1 ? marginInner : marginOuter);

  const paintFurniture = (target: PDFPage, index: number) => {
    if (index === 0) return;
    const pageNumber = index + 1;
    if (settings.runningHeads) {
      const label = pageNumber % 2 === 1 ? chapterTitle : bundle.book.title;
      target.drawText(clip(label, font, 9, contentWidth()), {
        x: pageNumber % 2 === 1 ? marginInner : marginOuter,
        y: pageHeight - marginTop / 2,
        size: 9,
        font,
        color: rgb(0.28, 0.24, 0.2),
      });
    }
    const num = String(pageNumber);
    target.drawText(num, {
      x: (pageWidth - font.widthOfTextAtSize(num, 9)) / 2,
      y: marginBottom / 2.4,
      size: 9,
      font,
      color: rgb(0.28, 0.24, 0.2),
    });
  };

  const nextPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pageIndex += 1;
    y = pageHeight - marginTop;
    paintFurniture(page, pageIndex);
  };

  const ensure = (height: number) => {
    if (y - height < marginBottom) nextPage();
  };

  const drawWrapped = (
    text: string,
    face: PDFFont,
    size: number,
    options?: { center?: boolean; indent?: number; firstIndent?: number; gap?: number },
  ) => {
    const safe = winAnsi(text).trim();
    if (!safe) return;
    const indent = options?.indent ?? 0;
    const width = Math.max(40, contentWidth() - indent);
    const words = safe.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(trial, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = trial;
    }
    if (line) lines.push(line);
    lines.forEach((entry, index) => {
      ensure(size + 3);
      const extra = index === 0 ? (options?.firstIndent ?? 0) : 0;
      const textWidth = face.widthOfTextAtSize(entry, size);
      const x = options?.center ? (pageWidth - textWidth) / 2 : marginLeft() + indent + extra;
      page.drawText(entry, { x, y: y - size, size, font: face, color: rgb(0.12, 0.1, 0.08) });
      y -= size * 1.35;
    });
    y -= options?.gap ?? 6;
  };

  drawWrapped(bundle.book.title, bold, 22, { center: true, gap: 12 });
  if (bundle.book.subtitle) drawWrapped(bundle.book.subtitle, italic, 13, { center: true, gap: 14 });
  drawWrapped(bundle.book.authorName, font, 12, { center: true, gap: 8 });
  if (settings.blankVerso) nextPage();

  for (const item of includedSpine(bundle)) {
    if (item.role === "title") continue;
    if (item.role === "chapter") chapterTitle = item.title;
    nextPage();
    if (item.role === "chapter" && settings.chapterNumbers && item.chapterNumber) {
      drawWrapped(`Chapter ${item.chapterNumber}`, italic, 11, { center: true, gap: 2 });
    }
    if (settings.theme === "ornament" && item.role === "chapter") drawWrapped("*", font, 14, { center: true, gap: 2 });
    drawWrapped(item.title, bold, item.role === "chapter" ? 18 : 14, { center: true, gap: 14 });
    let drop = item.role === "chapter" && settings.dropCap;
    for (const block of item.blocks) {
      if (block.type === "scene") {
        drawWrapped(settings.sceneBreak || "*", font, 12, { center: true, gap: 8 });
        continue;
      }
      if (block.type === "ul" || block.type === "ol") {
        block.items.forEach((entry, index) => {
          drawWrapped(`${block.type === "ol" ? `${index + 1}.` : "-"} ${inlinePlain(entry)}`, font, 11, { gap: 3 });
        });
        y -= 6;
        continue;
      }
      if (block.type === "table") {
        block.rows.forEach((row) => drawWrapped(row.map((cell) => inlinePlain(cell)).join("  |  "), font, 10, { gap: 2 }));
        y -= 8;
        continue;
      }
      const text = inlinePlain(prose(block));
      const face = block.type === "blockquote" ? italic : block.type === "p" ? font : bold;
      const size = block.type === "h2" ? 14 : block.type === "h3" || block.type === "h1" ? 12 : 11;
      if (drop && text) {
        drop = false;
        const letter = winAnsi(text).slice(0, 1);
        const rest = winAnsi(text).slice(1).trimStart();
        ensure(32);
        page.drawText(letter, { x: marginLeft(), y: y - 28, size: 28, font: bold, color: rgb(0.12, 0.1, 0.08) });
        drawWrapped(rest, font, 11, { indent: bold.widthOfTextAtSize(letter, 28) + 8, gap: 8 });
      } else {
        drawWrapped(text, face, size, { firstIndent: block.type === "p" ? 14 : 0, gap: block.type === "p" ? 3 : 8 });
      }
    }
  }
  return pdf.save();
}
