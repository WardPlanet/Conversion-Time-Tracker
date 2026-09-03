import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";

/**
 * Every trainer's unavailability blocks in one call — fans out over the
 * existing per-trainer store method (an admin actor may pass any
 * trainerId) rather than adding a new "list all" DataStore method, since
 * this is the only place that needs the org-wide view.
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const actor = { id: auth.session.userId, role: auth.session.role };
  const trainers = await store.listTrainers();
  const blocksPerTrainer = await Promise.all(
    trainers.map((t) => store.listUnavailabilityBlocksForTrainer(t.id, actor))
  );

  return NextResponse.json({ blocks: blocksPerTrainer.flat() });
}
