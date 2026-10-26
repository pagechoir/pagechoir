import { syncBundle } from "@/lib/db";
import { readBundle, requireBook } from "@/lib/api";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireBook(id, true);
  if ("error" in result && result.error) return result.error;
  if (!("role" in result)) return Response.json({ error: "That book is not on this account." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const incoming = readBundle(body?.bundle);
  if (!incoming) return Response.json({ error: "The manuscript payload was incomplete." }, { status: 400 });
  const bundle = await syncBundle(id, incoming, result.role);
  if (!bundle) return Response.json({ error: "That book is not on this account." }, { status: 404 });
  return Response.json({ bundle });
}
