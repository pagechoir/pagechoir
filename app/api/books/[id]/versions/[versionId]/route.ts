import { getVersion } from "@/lib/db";
import { requireBook } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  const result = await requireBook(id);
  if ("error" in result && result.error) return result.error;
  const version = await getVersion(id, versionId);
  if (!version) return Response.json({ error: "That version is gone." }, { status: 404 });
  return Response.json({ version });
}
