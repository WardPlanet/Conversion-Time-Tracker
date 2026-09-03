"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastInput {
  message: string;
  onUndo?: () => void | Promise<void>;
}

interface ToastState extends ToastInput {
  id: number;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

/**
 * One shared toast slot per role section, mounted once in each of the
 * trainer and admin layouts — every confirmation (accept/reject, clock-out,
 * a saved edit) funnels through that section's single instance instead of
 * each feature rendering its own.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const id = ++nextId.current;
    setToast({ id, ...input });
    timeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, AUTO_DISMISS_MS);
  }, []);

  async function handleUndo() {
    const onUndo = toast?.onUndo;
    dismiss();
    await onUndo?.();
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-md border border-brand-green/30 bg-brand-green/10 px-4 py-3 shadow-lg">
            <span className="text-sm font-medium text-brand-green">
              {toast.message}
            </span>
            {toast.onUndo && (
              <button
                onClick={handleUndo}
                className="text-sm font-semibold text-brand-green underline hover:text-brand-darkBlue"
              >
                Undo
              </button>
            )}
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-brand-green/80 hover:text-brand-green"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
