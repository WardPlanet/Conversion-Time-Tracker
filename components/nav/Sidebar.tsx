"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useLogout } from "@/lib/auth/use-logout";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ICON_BUTTON_CLASS =
  "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors";
const ICON_BUTTON_INACTIVE = "text-white/70 hover:bg-white/10 hover:text-white";
const ICON_BUTTON_ACTIVE = "bg-brand-blue text-white";

/** Tooltip that only makes sense on hover, so it's purely a desktop-sidebar affordance — harmless (if unused) on the mobile tab bar. */
function Tooltip({
  label,
  position,
}: {
  label: string;
  position: "right" | "top";
}) {
  const positionClass =
    position === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "bottom-full left-1/2 mb-2 -translate-x-1/2";

  return (
    <span
      className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-brand-darkBlue px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 ${positionClass}`}
    >
      {label}
    </span>
  );
}

function SidebarLink({
  item,
  active,
  tooltipPosition,
}: {
  item: SidebarNavItem;
  active: boolean;
  tooltipPosition: "right" | "top";
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`${ICON_BUTTON_CLASS} ${active ? ICON_BUTTON_ACTIVE : ICON_BUTTON_INACTIVE}`}
    >
      <Icon className="h-5 w-5" />
      <Tooltip label={item.label} position={tooltipPosition} />
    </Link>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Consolidates Dashboard/Settings/Sign-out behind one avatar button instead
 * of three separate icons — the dropdown already covers all three
 * destinations, so keeping standalone Settings/Sign-out icons alongside it
 * would just be a redundant second way to reach the same two places.
 */
function UserMenu({
  userName,
  dashboardHref,
  settingsHref,
  menuPosition,
}: {
  userName: string;
  dashboardHref: string;
  settingsHref: string;
  menuPosition: "right" | "top";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

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

  const menuPositionClass =
    menuPosition === "right"
      ? "bottom-0 left-full ml-2"
      : "bottom-full right-0 mb-2";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${userName} — account menu`}
        aria-expanded={open}
        className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blueWater text-xs font-semibold text-brand-darkBlue transition-colors hover:bg-white"
      >
        {getInitials(userName)}
        {!open && <Tooltip label={userName} position={menuPosition} />}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-40 rounded-md border border-brand-darkBlue/10 bg-white p-1 shadow-lg ${menuPositionClass}`}
        >
          <Link
            href={dashboardHref}
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-brand-darkBlue/80 hover:bg-brand-blueWater"
          >
            Dashboard
          </Link>
          <Link
            href={settingsHref}
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-sm text-brand-darkBlue/80 hover:bg-brand-blueWater"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-brand-darkBlue/80 hover:bg-brand-blueWater"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Icon-only left sidebar (desktop) / bottom tab bar (mobile) shared by both
 * the trainer and admin layouts — only `mainItems`, `settingsHref`,
 * `dashboardHref`, and `userName` differ between the two roles.
 */
export function Sidebar({
  mainItems,
  settingsHref,
  dashboardHref,
  appLabel,
  userName,
  bottomExtra,
}: {
  mainItems: SidebarNavItem[];
  settingsHref: string;
  dashboardHref: string;
  appLabel: string;
  userName: string;
  /**
   * Extra icon rendered alongside the user menu at the bottom — e.g. the
   * admin-only notification bell. A function (not a plain node) so it can
   * be told which of the two sidebar layouts it's rendering into, exactly
   * like {@link UserMenu}'s own `menuPosition` prop. Omitted entirely when
   * not passed, so other roles' sidebars are unaffected.
   */
  bottomExtra?: (menuPosition: "right" | "top") => ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop: fixed full-height icon rail on the left. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-white/10 bg-brand-darkBlue sm:flex">
        <div className="flex h-20 items-center justify-center border-b border-white/10">
          <Link
            href={dashboardHref}
            aria-label={`${appLabel} — go to dashboard`}
            className="flex items-center justify-center rounded-lg p-3 opacity-100 transition-opacity hover:opacity-70"
          >
            <img
              src="/GetGroupImage-1.jpg"
              alt={appLabel}
              width={360}
              height={360}
              className="h-10 w-10 rounded-sm object-contain"
            />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-2 px-2 pt-4">
          <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 p-2">
            {mainItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                tooltipPosition="right"
              />
            ))}
          </div>
        </nav>

        <div className="flex flex-col items-center gap-1 border-t border-white/10 py-5">
          {bottomExtra?.("right")}
          <UserMenu
            userName={userName}
            dashboardHref={dashboardHref}
            settingsHref={settingsHref}
            menuPosition="right"
          />
        </div>
      </aside>

      {/* Mobile: bottom tab bar — same items, no room for a side rail. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/10 bg-brand-darkBlue py-1.5 sm:hidden">
        {mainItems.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            tooltipPosition="top"
          />
        ))}
        {bottomExtra?.("top")}
        <UserMenu
          userName={userName}
          dashboardHref={dashboardHref}
          settingsHref={settingsHref}
          menuPosition="top"
        />
      </nav>
    </>
  );
}
