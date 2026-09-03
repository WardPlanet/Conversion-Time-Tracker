import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query param is required." },
      { status: 400 }
    );
  }

  const offices = await store.listOfficesForProject(projectId);
  return NextResponse.json({ offices });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!projectId || !name) {
    return NextResponse.json(
      { error: "projectId and name are required." },
      { status: 400 }
    );
  }

  try {
    const office = await store.createOffice(
      { projectId, name },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ office }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create office.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
