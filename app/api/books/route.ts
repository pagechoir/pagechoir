import { createBook, listBooks } from "@/lib/db";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ books: await listBooks(user.id) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? "Untitled book").slice(0, 180);
  const authorName = String(body?.authorName ?? user.name ?? "").slice(0, 180);
  const bundle = await createBook(user.id, title, authorName);
  return Response.json({ bundle, role: "owner", lastOpenedAt: "", lastCommentSeenAt: "" });
}
