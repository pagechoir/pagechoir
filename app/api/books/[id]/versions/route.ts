import { addVersion, listVersions } from "@/lib/db";
import { readBundle, requireBook } from "@/lib/api";
import { canWrite } from "@/lib/model";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireBook(id);
  if ("error" in result && result.error) return result.error;
  return Response.json({ versions: await listVersions(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await requireBook(id, true);
  if ("error" in result && result.error) return result.error;
  if (!("role" in result) || !canWrite(result.role)) {
    return Response.json({ error: "You cannot save a version of this book." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const snapshot = readBundle(body?.snapshot);
  if (!snapshot) return Response.json({ error: "The version was empty." }, { status: 400 });
  const name = String(body?.name ?? "Snapshot").slice(0, 120);
  const version = await addVersion(id, name, Boolean(body?.auto), snapshot);
  return Response.json({ version });
}
