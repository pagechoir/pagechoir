"use client";

import { use } from "react";
import { BoardsView } from "@/components/boards-view";

export default function BoardsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  return <BoardsView boardId={slug?.[0]} />;
}
