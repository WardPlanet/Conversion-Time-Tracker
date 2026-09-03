import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { ProductLine } from "@/lib/types";

const VALID_PRODUCT_LINES: ProductLine[] = [
  "denticon",
  "cloud9",
  "internal_admin",
];

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const projects = await store.listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const productLine = body?.productLine;
  const color = typeof body?.color === "string" ? body.color.trim() : "";
  const projectId =
    typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const bccEmail =
    typeof body?.bccEmail === "string" ? body.bccEmail.trim() : "";
  const notes =
    typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : undefined;

  if (
    !name ||
    !VALID_PRODUCT_LINES.includes(productLine) ||
    !color ||
    !projectId ||
    !bccEmail
  ) {
    return NextResponse.json(
      {
        error: `name, color, projectId, bccEmail, and a valid productLine (${VALID_PRODUCT_LINES.join(
          ", "
        )}) are required.`,
      },
      { status: 400 }
    );
  }

  try {
    const project = await store.createProject(
      { name, productLine, color, projectId, bccEmail, notes },
      { id: auth.session.userId, role: auth.session.role }
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
