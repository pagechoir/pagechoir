import { addComment, findShare } from "@/lib/db";
import { now, uid } from "@/lib/model";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const found = await findShare(token);
  if (!found) return Response.json({ error: "This preview link is not active." }, { status: 404 });
  if (found.share.role !== "commenter") {
    return Response.json({ error: "This link is for reading only." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) return Response.json({ error: "Write a comment before sending it." }, { status: 400 });
  const nodeId = String(body?.nodeId ?? "");
  if (!found.bundle.nodes.some((node) => node.id === nodeId)) {
    return Response.json({ error: "That passage is not in this preview." }, { status: 400 });
  }
  const comment = await addComment(found.bundle.book.id, {
    id: uid(),
    nodeId,
    userId: null,
    authorName: String(body?.authorName ?? "Reader").slice(0, 80) || "Reader",
    quote: String(body?.quote ?? "").slice(0, 400),
    body: text.slice(0, 4000),
    type: "comment",
    resolved: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return Response.json({ comment });
}
