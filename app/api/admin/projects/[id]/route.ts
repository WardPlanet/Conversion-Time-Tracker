import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import type { ProductLine, ProjectStatus } from "@/lib/types";

const VALID_PRODUCT_LINES: ProductLine[] = [
  "denticon",
  "cloud9",
  "internal_admin",
];

const VALID_PROJECT_STATUSES: ProjectStatus[] = [
  "active",
  "on_hold",
  "completed",
  "deactivated",
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const actor = { id: auth.session.userId, role: auth.session.role };

  try {
    if (typeof body?.status === "string") {
      if (!VALID_PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
        return NextResponse.json(
          {
            error: `status must be one of: ${VALID_PROJECT_STATUSES.join(", ")}.`,
          },
          { status: 400 }
        );
      }
      const project = await store.setProjectStatus(
        params.id,
        body.status as ProjectStatus,
        actor
      );
      return NextResponse.json({ project });
    }

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
          error: `status (${VALID_PROJECT_STATUSES.join(
            ", "
          )}), or name, color, projectId, bccEmail, and a valid productLine (${VALID_PRODUCT_LINES.join(
            ", "
          )}), is required.`,
        },
        { status: 400 }
      );
    }

    const project = await store.updateProjectDetails(
      params.id,
      { name, productLine, color, projectId, bccEmail, notes },
      actor
    );
    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
