"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Right-side slide-in panel — the drawer counterpart to the centered `Modal`. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-darkBlue/50"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-sm flex-col bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-brand-darkBlue/10 px-6 py-4">
          <h2 className="text-lg font-medium text-brand-darkBlue">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-brand-darkBlue/40 hover:text-brand-darkBlue/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
