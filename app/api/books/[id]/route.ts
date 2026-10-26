import { deleteBook } from "@/lib/db";
import { requireBook, requireUser } from "@/lib/api";
import { accessRole } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireBook(id);
  if ("error" in result && result.error) return result.error;
  if (!("bundle" in result)) return Response.json({ error: "That book is not on this account." }, { status: 404 });
  return Response.json({
    bundle: result.bundle,
    role: result.role,
    lastOpenedAt: result.lastOpenedAt,
    lastCommentSeenAt: result.lastCommentSeenAt,
  });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const role = await accessRole(user.id, id);
  if (role !== "owner") return Response.json({ error: "Only the owner can delete this book." }, { status: 403 });
  await deleteBook(id);
  return Response.json({ ok: true });
}
