"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Labeled password input with a show/hide eye toggle — shared by the admin Add Trainer form and the trainer's own Change Password form. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-darkBlue/80">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 pr-10 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-darkBlue/50 hover:text-brand-darkBlue"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  );
}
