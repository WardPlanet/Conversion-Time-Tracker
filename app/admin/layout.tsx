import { getSession } from "@/lib/auth/get-session";
import { store } from "@/lib/data";
import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/ToastProvider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session ? await store.getUserById(session.userId) : null;

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <AdminNav userName={user?.name ?? session?.username ?? ""} />
        <main className="pb-16 sm:pb-0 sm:pl-16">
          <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
