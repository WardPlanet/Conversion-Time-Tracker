import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import type { Role } from "@/lib/types";
import type { SessionPayload } from "@/lib/auth/session";

type RequireRoleResult =
  | { session: SessionPayload; response: null }
  | { session: null; response: NextResponse };

/** Verifies the session cookie and that it belongs to the given role. */
export async function requireRole(role: Role): Promise<RequireRoleResult> {
  const session = await getSession();

  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  if (session.role !== role) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { session, response: null };
}
