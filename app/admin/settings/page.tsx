import Link from "next/link";
import { FlagThresholdsForm } from "@/components/admin/FlagThresholdsForm";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Settings</h1>

      <div className="mt-6">
        <section className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-6">
          <h2 className="text-lg font-medium">Flag thresholds</h2>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            Controls when the Flags section on the{" "}
            <Link href="/admin" className="text-brand-blue hover:underline">
              Dashboard
            </Link>{" "}
            automatically surfaces something for review.
          </p>
          <div className="mt-4">
            <FlagThresholdsForm />
          </div>
        </section>
      </div>
    </div>
  );
}
