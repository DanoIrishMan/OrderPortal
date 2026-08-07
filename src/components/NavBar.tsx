"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { Session } from "next-auth";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pathways", label: "Critical Pathways" },
  { href: "/admin/imports", label: "Order Upload" },
  { href: "/admin/exports", label: "Export" },
  { href: "/admin/settings", label: "Settings" },
];

const staffLinks = [
  { href: "/staff/pathways", label: "My Tasks" },
];

const portalLinks = [
  { href: "/portal", label: "My Orders" },
  { href: "/portal/export", label: "Download Report" },
  { href: "/portal/account", label: "Account" },
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
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            } ${className ?? ""}`}
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
              { href: "/staff/settings", label: "Settings" },
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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 md:gap-8">
          <Link href={isAdmin ? "/admin" : isStaff ? "/staff" : "/portal"} className="text-lg font-semibold text-slate-900">
            Pro Club Portal
          </Link>
          <nav className="hidden gap-1 md:flex">
            <NavLinks links={links} pathname={pathname} />
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? "Administrator"
                : isStaff
                  ? session?.user?.staffRole === "DESIGNER"
                    ? "Designer"
                    : "Account Manager"
                  : session?.user?.clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 md:hidden"
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
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-slate-200 px-4 py-3 md:hidden">
          <div className="mb-3 sm:hidden">
            <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? "Administrator"
                : isStaff
                  ? session?.user?.staffRole === "DESIGNER"
                    ? "Designer"
                    : "Account Manager"
                  : session?.user?.clientName}
            </p>
          </div>
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
