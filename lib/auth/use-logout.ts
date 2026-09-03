"use client";

import { useRouter } from "next/navigation";

/** Client-only — signs out and redirects to /login. Shared by every sign-out affordance so the actual logout call lives in exactly one place. */
export function useLogout() {
  const router = useRouter();

  return async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
}
