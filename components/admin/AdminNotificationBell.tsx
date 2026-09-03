"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { Notification } from "@/lib/types";
import { countUnread, notificationHref } from "@/lib/domain/notifications";
import { formatDateTime } from "@/lib/format";

const POLL_MS = 20000;

/**
 * Bell icon rendered near the admin sidebar's user menu — tracks unread
 * notifications generated when a flag becomes active, a trainer submits a
 * week, or a trainer requests a booking cancellation. Polls on an interval
 * (this app has no push/websocket layer) so the unread count stays current
 * even without a manual refresh.
 */
export function AdminNotificationBell({
  menuPosition,
}: {
  menuPosition: "right" | "top";
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/notifications");
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(data.notifications ?? []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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

  async function handleSelect(notification: Notification) {
    setOpen(false);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    if (!notification.read) {
      await fetch(`/api/admin/notifications/${notification.id}`, {
        method: "PATCH",
      });
    }
    router.push(notificationHref(notification));
  }

  const unreadCount = countUnread(notifications);
  const menuPositionClass =
    menuPosition === "right"
      ? "bottom-0 left-full ml-2"
      : "bottom-full right-0 mb-2";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={
          unreadCount > 0
            ? `Notifications — ${unreadCount} unread`
            : "Notifications"
        }
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
        <div
          className={`absolute z-50 w-80 rounded-md border border-brand-darkBlue/10 bg-white shadow-lg ${menuPositionClass}`}
        >
          <div className="border-b border-brand-darkBlue/10 px-3 py-2">
            <p className="text-sm font-medium text-brand-darkBlue">
              Notifications
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-brand-darkBlue/60">
                No notifications yet.
              </p>
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
                            notification.read
                              ? "bg-transparent"
                              : "bg-brand-blue"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              notification.read
                                ? "text-brand-darkBlue/70"
                                : "font-semibold text-brand-darkBlue"
                            }`}
                          >
                            {notification.message}
                          </p>
                          <p className="mt-0.5 text-xs text-brand-darkBlue/50">
                            {formatDateTime(notification.createdAt)}
                          </p>
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
  );
}
