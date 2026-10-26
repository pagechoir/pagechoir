"use client";

import { use } from "react";
import { BookProvider } from "@/components/book-provider";
import { BookShell } from "@/components/shell";

export default function BookLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <BookProvider bookId={id}>
      <BookShell>{children}</BookShell>
    </BookProvider>
  );
}
