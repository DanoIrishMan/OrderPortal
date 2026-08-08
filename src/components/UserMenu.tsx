"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "next-auth";

interface MenuItem {
  href?: string;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
}

function buildMenuItems(session: Session | null): MenuItem[] {
  if (!session?.user) return [];

  const role = session.user.role;
  const staffRole = session.user.staffRole;
  const items: MenuItem[] = [];

  if (role === "ADMIN") {
    items.push({ href: "/admin/settings", label: "Portal settings" });
    items.push({ href: "/admin/account", label: "Change password" });
  } else if (role === "STAFF") {
    if (staffRole === "ACCOUNT_MANAGER") {
      items.push({ href: "/staff/settings", label: "Settings" });
    }
    items.push({ href: "/staff/account", label: "Change password" });
  } else {
    items.push({ href: "/portal/account", label: "Account" });
  }

  items.push({
    label: "Sign out",
    destructive: true,
    onClick: () => signOut({ callbackUrl: "/login" }),
  });

  return items;
}

function roleLabel(session: Session | null) {
  if (!session?.user) return "";
  if (session.user.role === "ADMIN") return "Admin";
  if (session.user.role === "STAFF") {
    return session.user.staffRole === "DESIGNER" ? "Designer" : "Account Manager";
  }
  return session.user.clientName ?? "Client";
}

export function UserMenu({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = buildMenuItems(session);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!session?.user) return null;

  const isStaff = session.user.role === "STAFF";
  const isAdmin = session.user.role === "ADMIN";
  const showBadge = isAdmin || isStaff;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="user-menu-info">
          <span className="user-menu-name">{session.user.name}</span>
          <span className="user-menu-meta">
            {showBadge ? <span className="role-badge">{roleLabel(session)}</span> : roleLabel(session)}
          </span>
        </span>
        <svg
          className={`user-menu-chevron ${open ? "user-menu-chevron-open" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-dropdown-header sm:hidden">
            <p className="text-sm font-semibold text-primary">{session.user.name}</p>
            <p className="text-xs text-muted">{roleLabel(session)}</p>
          </div>
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.href}
                href={item.href}
                className="user-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                className={`user-menu-item w-full text-left ${item.destructive ? "user-menu-item-danger" : ""}`}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
