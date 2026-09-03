import { NextResponse } from "next/server";
import { store, isForbiddenError } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

export async function GET() {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const trainerId = auth.session.userId;
  const [favorites, tasks] = await Promise.all([
    store.listFavoriteTasksForTrainer(trainerId),
    store.listTasksForTrainer(trainerId),
  ]);

  // Distinct task names the trainer has already logged against — offered
  // as suggestions when adding a new favorite, alongside free text.
  const taskNames = Array.from(new Set(tasks.map((t) => t.title))).sort();

  return NextResponse.json({ favorites, taskNames });
}

export async function POST(request: Request) {
  const auth = await requireRole("trainer");
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const taskName = typeof body?.taskName === "string" ? body.taskName : "";

  if (!taskName.trim()) {
    return NextResponse.json(
      { error: "taskName is required." },
      { status: 400 }
    );
  }

  try {
    const favorite = await store.addFavoriteTask(taskName, {
      id: auth.session.userId,
      role: auth.session.role,
    });
    return NextResponse.json({ favorite }, { status: 201 });
  } catch (err) {
    if (isForbiddenError(err)) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to add favorite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
