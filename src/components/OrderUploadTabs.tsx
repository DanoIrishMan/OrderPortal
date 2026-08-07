"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { slug: "pdf", label: "In-House PDF" },
  { slug: "csv", label: "Weekly Production CSV" },
] as const;

export function OrderUploadTabs() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/staff/imports") ? "/staff/imports" : "/admin/imports";

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tab.slug}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OrderUploadHub() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/staff/imports") ? "/staff/imports" : "/admin/imports";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link href={`${basePath}/pdf`} className="card block transition hover:border-slate-300">
        <h2 className="text-lg font-semibold text-slate-900">In-House PDF</h2>
        <p className="mt-2 text-sm text-slate-600">
          Add in-house production orders by uploading a PDF from your jobs system. Select the club,
          review extracted fields, then add the order.
        </p>
      </Link>

      <Link href={`${basePath}/csv`} className="card block transition hover:border-slate-300">
        <h2 className="text-lg font-semibold text-slate-900">Weekly Production CSV</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload your offshore factory Sales Rep Summary CSV. Orders are routed to club accounts and
          updated each week by order number.
        </p>
      </Link>
    </div>
  );
}
