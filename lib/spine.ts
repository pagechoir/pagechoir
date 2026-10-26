import { blocksPlain, docToBlocks, type Block } from "./blocks";
import { childrenOf, type BookBundle, type DocNode } from "./model";

export type SpineItem = {
  id: string;
  role: "title" | "matter" | "part" | "chapter" | "back";
  title: string;
  blocks: Block[];
  chapterNumber: number | null;
  included: boolean;
};

function matterBlocks(node: DocNode): Block[] {
  if (node.matterKey === "title") return [];
  return docToBlocks(node.content);
}

export function spineOf(bundle: BookBundle): SpineItem[] {
  const items: SpineItem[] = [];
  let chapterNumber = 0;
  const visit = (node: DocNode) => {
    if (node.kind === "part") {
      items.push({ id: node.id, role: "part", title: node.title, blocks: [], chapterNumber: null, included: node.included });
      for (const child of childrenOf(bundle.nodes, node.id)) visit(child);
      return;
    }
    if (node.kind === "chapter") {
      if (node.included) chapterNumber += 1;
      const blocks = docToBlocks(node.content);
      for (const scene of childrenOf(bundle.nodes, node.id)) {
        if (!scene.included) continue;
        blocks.push({ type: "scene" });
        blocks.push(...docToBlocks(scene.content));
      }
      items.push({
        id: node.id,
        role: "chapter",
        title: node.title || "Chapter",
        blocks,
        chapterNumber: node.included ? chapterNumber : null,
        included: node.included,
      });
      return;
    }
    if (node.kind === "front") {
      items.push({
        id: node.id,
        role: node.matterKey === "title" ? "title" : "matter",
        title: node.title,
        blocks: matterBlocks(node),
        chapterNumber: null,
        included: node.included,
      });
      return;
    }
    if (node.kind === "back") {
      items.push({
        id: node.id,
        role: "back",
        title: node.title,
        blocks: docToBlocks(node.content),
        chapterNumber: null,
        included: node.included,
      });
    }
  };
  for (const node of childrenOf(bundle.nodes, null)) visit(node);
  for (const scene of bundle.nodes.filter((node) => node.kind === "scene" && !bundle.nodes.some((parent) => parent.id === node.parentId && parent.kind === "chapter"))) {
    items.push({
      id: scene.id,
      role: "chapter",
      title: scene.title || "Scene",
      blocks: docToBlocks(scene.content),
      chapterNumber: null,
      included: scene.included,
    });
  }
  return items;
}

export function includedSpine(bundle: BookBundle) {
  return spineOf(bundle).filter((item) => item.included);
}

export function spineText(bundle: BookBundle) {
  return includedSpine(bundle)
    .map((item) => [item.title, blocksPlain(item.blocks)].filter(Boolean).join("\n\n"))
    .join("\n\n");
}
