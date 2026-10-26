import { now, uid, type Board, type BoardItem, type Folder } from "./model";

export type BoardSeed = { board: Board; folders: Folder[]; items: BoardItem[] };

function item(boardId: string, folderId: string | null, title: string, body: string, order: number, stamp: string): BoardItem {
  return {
    id: uid(),
    boardId,
    folderId,
    title,
    body,
    attributes: [],
    order,
    updatedAt: stamp,
  };
}

function folder(boardId: string, name: string, order: number, stamp: string): Folder {
  return { id: uid(), boardId, name, order, updatedAt: stamp };
}

export function boardFromTemplate(template: "blank" | "research" | "three-act" | "hero" | "scene-sequel", order: number): BoardSeed {
  const stamp = now();
  const board: Board = {
    id: uid(),
    name:
      template === "research"
        ? "Research"
        : template === "three-act"
          ? "Three act"
          : template === "hero"
            ? "Hero's journey"
            : template === "scene-sequel"
              ? "Scene and sequel"
              : "Board",
    order,
    updatedAt: stamp,
  };
  if (template === "blank") return { board, folders: [], items: [] };
  if (template === "research") {
    const note = item(board.id, null, "Source note", "What this source changes in the book.", 0, stamp);
    note.attributes = [
      { id: uid(), key: "Source", value: "" },
      { id: uid(), key: "Quote", value: "" },
      { id: uid(), key: "Page", value: "" },
    ];
    return { board, folders: [], items: [note] };
  }
  if (template === "three-act") {
    const folders = ["Act I", "Act II", "Act III"].map((name, index) => folder(board.id, name, index, stamp));
    const prompts = [
      ["Opening image", "The world as it stands before the story pushes."],
      ["Turn", "The choice that makes the middle inevitable."],
      ["Payoff", "The consequence the opening promised."],
    ];
    const items = folders.map((group, index) => item(board.id, group.id, prompts[index][0], prompts[index][1], 0, stamp));
    return { board, folders, items };
  }
  if (template === "hero") {
    const stages = [
      ["Ordinary world", "Show the life that the journey will interrupt."],
      ["Call", "Something arrives that asks the character to move."],
      ["Refusal", "They hesitate, and the cost of staying is visible."],
      ["Mentor", "Someone or something hands them a way forward."],
      ["Threshold", "They leave the old rules behind."],
      ["Tests", "Allies, rivals, and small losses rearrange the plan."],
      ["Ordeal", "The thing they feared happens, and they do not come out the same."],
      ["Reward", "They take something back, even if it is only knowledge."],
      ["The road back", "The old world pulls, and the new one demands a choice."],
      ["Return", "They come home changed, and the opening image no longer fits."],
    ];
    const items = stages.map(([title, body], index) => item(board.id, null, title, body, index, stamp));
    return { board, folders: [], items };
  }
  const scene = folder(board.id, "Scene", 0, stamp);
  const sequel = folder(board.id, "Sequel", 1, stamp);
  const items = [
    item(board.id, scene.id, "Goal", "What the viewpoint character wants in this scene.", 0, stamp),
    item(board.id, scene.id, "Conflict", "Who or what refuses them.", 1, stamp),
    item(board.id, scene.id, "Disaster", "The setback that ends the scene.", 2, stamp),
    item(board.id, sequel.id, "Reaction", "The feeling immediately after the setback.", 0, stamp),
    item(board.id, sequel.id, "Dilemma", "The bad options now on the table.", 1, stamp),
    item(board.id, sequel.id, "Decision", "The choice that launches the next scene.", 2, stamp),
  ];
  return { board, folders: [scene, sequel], items };
}
