import { auth } from "@/auth";
import { accessRole, loadBundle, getDb, getMemberState } from "@/lib/db";
import { normalizeBundle, type BookBundle, type Role } from "@/lib/model";

export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return { id, email: session.user.email ?? "", name: session.user.name ?? "" };
}

export async function requireBook(bookId: string, write = false) {
  const user = await requireUser();
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) };
  const role = await accessRole(user.id, bookId);
  if (!role) return { error: Response.json({ error: "That book is not on this account." }, { status: 404 }) };
  if (write && role !== "owner" && role !== "coauthor") {
    return { error: Response.json({ error: "You can read this book, but you cannot change it." }, { status: 403 }) };
  }
  const db = await getDb();
  const bundle = await loadBundle(db, bookId);
  if (!bundle) return { error: Response.json({ error: "That book is not on this account." }, { status: 404 }) };
  const state = await getMemberState(user.id, bookId);
  return { user, role: role as Role, bundle, lastOpenedAt: state.lastOpenedAt, lastCommentSeenAt: state.lastCommentSeenAt };
}

export function readBundle(value: unknown): BookBundle | null {
  if (!value || typeof value !== "object" || !("book" in value)) return null;
  const book = (value as { book?: { id?: string } }).book;
  if (!book?.id) return null;
  try {
    return normalizeBundle(value as BookBundle);
  } catch {
    return null;
  }
}
