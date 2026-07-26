"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { Session } from "next-auth";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/imports/pdf", label: "In-House PDF" },
  { href: "/admin/imports/csv", label: "Weekly Production CSV" },
  { href: "/admin/exports", label: "Export" },
  { href: "/admin/settings", label: "Settings" },
];

const portalLinks = [
  { href: "/portal", label: "My Orders" },
  { href: "/portal/export", label: "Download Report" },
  { href: "/portal/account", label: "Account" },
];

export function NavBar({ session: initialSession }: { session?: Session | null }) {
  const pathname = usePathname();
  const { data: clientSession } = useSession();
  const session = clientSession ?? initialSession ?? null;
  const isAdmin = session?.user?.role === "ADMIN";
  const links = isAdmin ? adminLinks : portalLinks;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href={isAdmin ? "/admin" : "/portal"} className="text-lg font-semibold text-slate-900">
            Pro Club Portal
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{session?.user?.name}</p>
            <p className="text-xs text-slate-500">
              {isAdmin ? "Administrator" : session?.user?.clientName}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
