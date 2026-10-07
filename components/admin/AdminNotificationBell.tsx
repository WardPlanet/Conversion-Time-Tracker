"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import type { Notification } from "@/lib/types";
import { formatDateTime, formatDateRange } from "@/lib/format";

const POLL_MS = 20000;

type DeniedDetail = {
  booking: { title: string; startTime: string; endTime: string; rejectionReason?: string };
  trainer: { name: string } | null;
  project: { name: string } | null;
};

export function AdminNotificationBell({
  menuPosition,
}: {
  menuPosition: "right" | "top";
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [deniedDetail, setDeniedDetail] = useState<DeniedDetail | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/notifications");
    if (!response.ok) return;
    const data = await response.json();
    const all: Notification[] = data.notifications ?? [];
    // Only surface work order approved/denied notifications
    setNotifications(all.filter((n) => n.type === "work_order_approved" || n.type === "work_order_denied"));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function markAllReadOptimistically() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // Fire-and-forget PATCH for each unread notification
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        fetch(`/api/admin/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
      });
  }

  function handleOpen() {
    const wasOpen = open;
    setOpen((o) => !o);
    if (!wasOpen) {
      load();
      markAllReadOptimistically();
    }
  }

  async function handleSelect(notification: Notification) {
    setOpen(false);
    if (notification.type === "work_order_denied" && notification.relatedEntityId) {
      const res = await fetch(`/api/admin/bookings/${notification.relatedEntityId}`);
      if (res.ok) {
        const data = await res.json();
        setDeniedDetail({ booking: data.booking, trainer: data.trainer, project: data.project });
      }
    }
    // For approved notifications, no action needed (bell already shows the message)
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const menuPositionClass =
    menuPosition === "right"
      ? "bottom-0 left-full ml-2"
      : "bottom-full right-0 mb-2";

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={handleOpen}
          aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"}
          aria-expanded={open}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className={`absolute z-50 w-80 rounded-md border border-brand-darkBlue/10 bg-white shadow-lg ${menuPositionClass}`}>
            <div className="border-b border-brand-darkBlue/10 px-3 py-2">
              <p className="text-sm font-medium text-brand-darkBlue">Work Order Notifications</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-sm text-brand-darkBlue/60">No notifications yet.</p>
              ) : (
                <ul>
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(notification)}
                        className="block w-full border-b border-brand-darkBlue/5 px-3 py-2.5 text-left last:border-b-0 hover:bg-brand-blueWater"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              notification.read ? "bg-transparent" : "bg-brand-blue"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${notification.read ? "text-brand-darkBlue/70" : "font-semibold text-brand-darkBlue"}`}>
                              {notification.message}
                            </p>
                            <p className="mt-0.5 text-xs text-brand-darkBlue/50">
                              {formatDateTime(notification.createdAt)}
                            </p>
                            {notification.type === "work_order_denied" && (
                              <p className="mt-0.5 text-xs text-brand-blue underline">View denial details</p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Denial detail modal */}
      {deniedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-brand-darkBlue">Work Order Denied</h2>
              <button
                onClick={() => setDeniedDetail(null)}
                className="shrink-0 rounded p-1 text-brand-darkBlue/40 hover:bg-brand-blueWater hover:text-brand-darkBlue"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">Training</p>
                <p className="text-sm text-brand-darkBlue">{deniedDetail.booking.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">Dates</p>
                <p className="text-sm text-brand-darkBlue">
                  {formatDateRange(deniedDetail.booking.startTime, deniedDetail.booking.endTime)}
                </p>
              </div>
              {deniedDetail.trainer && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">Trainer</p>
                  <p className="text-sm text-brand-darkBlue">{deniedDetail.trainer.name}</p>
                </div>
              )}
              {deniedDetail.project && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">Project</p>
                  <p className="text-sm text-brand-darkBlue">{deniedDetail.project.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-darkBlue/40">Denial Reason</p>
                <p className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deniedDetail.booking.rejectionReason ?? "(No reason provided)"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDeniedDetail(null)}
              className="mt-6 w-full rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-darkBlue"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
