import { put } from "@vercel/blob";
import { requireUser } from "@/lib/api";
import { uid } from "@/lib/model";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Image storage is not configured." }, { status: 404 });
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > 4_000_000) return Response.json({ error: "Images sent to storage must be under 4 MB." }, { status: 400 });
  const blob = await put(`images/${uid()}-${file.name}`, file, { access: "public" });
  return Response.json({ url: blob.url });
}
