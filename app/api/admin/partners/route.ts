import { NextResponse } from "next/server";
import { store } from "@/lib/data";
import { requireRole } from "@/lib/auth/api-auth";
import { hashPasswordSync } from "@/lib/auth/password";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const [partners, trainers] = await Promise.all([
    store.listPartners(),
    store.listTrainers(),
  ]);

  return NextResponse.json({ partners, trainers });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.session) return auth.response;

  const body = await request.json();
  const actor = { id: auth.session.userId, role: auth.session.role };

  if (body.type === "partner") {
    const { name, contactEmail } = body;
    if (!name?.trim() || !contactEmail?.trim()) {
      return NextResponse.json({ error: "name and contactEmail are required." }, { status: 400 });
    }
    const partner = await store.createPartner({ name, contactEmail }, actor);
    return NextResponse.json({ partner }, { status: 201 });
  }

  if (body.type === "partner_admin") {
    const { username, password, name, email, partnerId } = body;
    if (!username?.trim() || !password?.trim() || !name?.trim() || !email?.trim() || !partnerId) {
      return NextResponse.json(
        { error: "username, password, name, email, and partnerId are required." },
        { status: 400 }
      );
    }
    const passwordHash = hashPasswordSync(password);
    const user = await store.createPartnerAdmin(
      { username, passwordHash, name, email, partnerId },
      actor
    );
    return NextResponse.json({ user }, { status: 201 });
  }

  if (body.type === "assign_trainer") {
    const { trainerId, partnerId } = body;
    if (!trainerId) {
      return NextResponse.json({ error: "trainerId is required." }, { status: 400 });
    }
    const user = await store.assignTrainerToPartner(trainerId, partnerId ?? null, actor);
    return NextResponse.json({ user });
  }

  return NextResponse.json({ error: "Unknown type." }, { status: 400 });
}
