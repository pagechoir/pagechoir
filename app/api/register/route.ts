import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Use at least 8 characters for the password." }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return Response.json({ error: "An account with that email already exists." }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, name, passwordHash });
  return Response.json({ id: user.id, email: user.email, name: user.name });
}
