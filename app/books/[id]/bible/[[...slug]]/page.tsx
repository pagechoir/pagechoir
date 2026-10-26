"use client";

import { use } from "react";
import { BibleView } from "@/components/bible-view";

export default function BiblePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  return <BibleView slug={slug?.[0]} />;
}
