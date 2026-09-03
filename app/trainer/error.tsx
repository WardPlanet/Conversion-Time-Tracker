"use client";

import Link from "next/link";

export default function TrainerSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-semibold text-red-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-red-700">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Try again
        </button>
        <Link
          href="/trainer"
          className="rounded-md border border-brand-darkBlue/20 bg-white px-4 py-2 text-sm hover:bg-brand-blueWater"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
