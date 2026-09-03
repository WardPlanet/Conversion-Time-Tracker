import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const trainers = await store.listTrainers();
  return NextResponse.json({ trainers });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!username || !password || !name || !email) {
    return NextResponse.json(
      { error: "username, password, name, and email are required." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const trainer = await store.createTrainer(
      { username, passwordHash, name, email },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ trainer }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create trainer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
