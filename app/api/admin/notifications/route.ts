import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const notifications = await store.listNotifications({
    id: auth.session.userId,
    role: auth.session.role,
  });

  return NextResponse.json({ notifications });
}
