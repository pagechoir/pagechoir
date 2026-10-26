import { listLogins } from "@/lib/db";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const sessions = await listLogins(user.id);
  return Response.json({
    user,
    sessions: sessions.map((session: { id: string; createdAt: string; userAgent: string }) => ({
      id: session.id,
      createdAt: session.createdAt,
      userAgent: session.userAgent,
    })),
  });
}
