"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pathways", label: "Critical Pathways" },
  { href: "/admin/imports", label: "Order Upload" },
  { href: "/admin/exports", label: "Export" },
];

const staffLinks = [
  { href: "/staff/pathways", label: "My Tasks" },
];

const portalLinks = [
  { href: "/portal", label: "My Orders" },
  { href: "/portal/export", label: "Download Report" },
];

function NavLinks({
  links,
  pathname,
  onNavigate,
  className,
}: {
  links: { href: string; label: string }[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <>
      {links.map((link) => {
        const isRootDashboard = link.href === "/admin" || link.href === "/staff";
        const active = isRootDashboard
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`nav-link ${active ? "nav-link-active" : ""} ${className ?? ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavBar({ session: initialSession }: { session?: Session | null }) {
  const pathname = usePathname();
  const { data: clientSession } = useSession();
  const session = clientSession ?? initialSession ?? null;
  const isAdmin = session?.user?.role === "ADMIN";
  const isStaff = session?.user?.role === "STAFF";
  const staffLinksFiltered = isStaff
    ? [
        ...(session?.user?.staffRole === "ACCOUNT_MANAGER"
          ? [{ href: "/staff", label: "Dashboard" }]
          : []),
        { href: "/staff/pathways", label: "My Tasks" },
        ...(session?.user?.staffRole === "ACCOUNT_MANAGER"
          ? [
              { href: "/staff/orders", label: "Client Orders" },
              { href: "/staff/imports", label: "Order Upload" },
            ]
          : []),
      ]
    : staffLinks;
  const links = isAdmin ? adminLinks : isStaff ? staffLinksFiltered : portalLinks;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="app-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3 md:gap-8">
          <Link href={isAdmin ? "/admin" : isStaff ? "/staff" : "/portal"} className="nav-brand">
            <span className="nav-brand-mark">PC</span>
            Pro Club Portal
          </Link>
          <nav className="nav-group">
            <NavLinks links={links} pathname={pathname} />
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <UserMenu session={session} />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="mobile-menu-btn btn-secondary !px-2.5 !py-2"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mobile-nav-panel">
          <div className="flex flex-col gap-1">
            <NavLinks
              links={links}
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
              className="block w-full"
            />
          </div>
        </nav>
      )}
    </header>
  );
}
