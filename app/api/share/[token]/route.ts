import { findShare } from "@/lib/db";
import { includedSpine } from "@/lib/spine";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const found = await findShare(token);
  if (!found) return Response.json({ error: "This preview link is not active." }, { status: 404 });
  const { share, bundle } = found;
  const nodes = share.nodeId ? bundle.nodes.filter((node) => node.id === share.nodeId || node.parentId === share.nodeId) : bundle.nodes;
  return Response.json({
    role: share.role,
    book: {
      title: bundle.book.title,
      subtitle: bundle.book.subtitle,
      authorName: bundle.book.authorName,
      settings: bundle.book.settings,
    },
    nodes,
    comments: share.role === "commenter" ? bundle.comments : [],
    spine: includedSpine({ ...bundle, nodes }).map((item) => ({ id: item.id, title: item.title, role: item.role })),
  });
}
