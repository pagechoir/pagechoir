import { markCommentsSeen, markOpened } from "@/lib/db";
import { requireBook } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireBook(id);
  if ("error" in result && result.error) return result.error;
  if (!("user" in result)) return Response.json({ error: "That book is not on this account." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (body?.comments) {
    const seen = await markCommentsSeen(result.user.id, id);
    return Response.json({ lastCommentSeenAt: seen });
  }
  const previous = await markOpened(result.user.id, id);
  return Response.json({ previous, lastOpenedAt: previous });
}
