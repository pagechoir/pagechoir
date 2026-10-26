import { redirect } from "next/navigation";

export default async function BookIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/books/${id}/write`);
}
