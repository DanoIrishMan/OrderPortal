"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { slug: "pdf", label: "In-House PDF" },
  { slug: "stock-order", label: "Stock / Embroidery (Excel)" },
  { slug: "csv", label: "Weekly Production CSV" },
] as const;

export function OrderUploadTabs() {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/staff/imports") ? "/staff/imports" : "/admin/imports";

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tab.slug}
            href={href}
            className={`tab-link ${active ? "tab-link-active" : ""}`}
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Link href={`${basePath}/pdf`} className="card card-interactive">
        <div className="card-icon">📄</div>
        <h2 className="section-title">In-House PDF</h2>
        <p className="section-subtitle">
          Add in-house production orders by uploading a PDF from your jobs system. Select the club,
          review extracted fields, then add the order.
        </p>
      </Link>

      <Link href={`${basePath}/stock-order`} className="card card-interactive">
        <div className="card-icon">🧵</div>
        <h2 className="section-title">Stock / Embroidery (Excel)</h2>
        <p className="section-subtitle">
          Upload OrderWise Core Stock Order Form Excel files for stock garments sent to embroidery.
          One order per spreadsheet.
        </p>
      </Link>

      <Link href={`${basePath}/csv`} className="card card-interactive">
        <div className="card-icon">📊</div>
        <h2 className="section-title">Weekly Production CSV</h2>
        <p className="section-subtitle">
          Upload your offshore factory Sales Rep Summary CSV. Orders are routed to club accounts and
          updated each week by order number.
        </p>
      </Link>
    </div>
  );
}
