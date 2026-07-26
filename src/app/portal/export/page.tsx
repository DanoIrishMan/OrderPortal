"use client";

import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";

export default function PortalExportPage() {
  const { data: session } = useSession();
  const clientId = session?.user?.clientId;

  function buildUrl(format: "xlsx" | "csv") {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    params.set("format", format);
    params.set("activeReport", "true");
    return `/api/exports?${params}`;
  }

  return (
    <div>
      <PageHeader
        title="Download Report"
        description="Export your active orders, including delivered items from the last two weeks"
      />

      <div className="card max-w-lg space-y-4">
        <p className="text-sm text-slate-600">
          Download a report of your active orders. Delivered orders stay on this report for two
          weeks before moving to the Delivered Orders tab.
        </p>

        <div className="flex gap-3">
          <a
            href={clientId ? buildUrl("xlsx") : "#"}
            className={`btn-primary ${!clientId ? "pointer-events-none opacity-50" : ""}`}
            download
          >
            Download Excel
          </a>
          <a
            href={clientId ? buildUrl("csv") : "#"}
            className={`btn-secondary ${!clientId ? "pointer-events-none opacity-50" : ""}`}
            download
          >
            Download CSV
          </a>
        </div>
      </div>
    </div>
  );
}
