import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { DISPLAY_STATUS_ORDER } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

interface DashboardStats {
  totalOrders: number;
  overdueOrders: number;
  displayStatusCounts: Array<{ status: string; count: number }>;
  recentImports: Array<{
    id: string;
    filename: string;
    type: string;
    successCount: number | null;
    createdAt: Date;
    client: { name: string } | null;
  }>;
}

interface DashboardOverviewProps {
  stats: DashboardStats;
  activeClients: number;
  description: string;
  uploadBasePath: "/admin/imports" | "/staff/imports";
}

export function DashboardOverview({
  stats,
  activeClients,
  description,
  uploadBasePath,
}: DashboardOverviewProps) {
  const statusMap = Object.fromEntries(
    stats.displayStatusCounts.map((entry) => [entry.status, entry.count])
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={description}
        action={
          <div className="flex gap-2">
            <Link href={`${uploadBasePath}/csv`} className="btn-primary">
              Weekly CSV
            </Link>
            <Link href={`${uploadBasePath}/pdf`} className="btn-secondary">
              In-House PDF
            </Link>
          </div>
        }
      />

      <div className="mb-8 stat-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard label="Overdue Deliveries" value={stats.overdueOrders} hint="Past expected date" />
        <StatCard label="Active Clients" value={activeClients} />
        <StatCard label="Recent Imports" value={stats.recentImports.length} hint="Last 5 uploads" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="section-title mb-4">Orders by Status</h2>
          <div className="space-y-3">
            {DISPLAY_STATUS_ORDER.map((status) => (
              <div key={status} className="status-row">
                <StatusBadge status={status} />
                <span className="text-sm font-semibold tabular-nums text-primary">
                  {statusMap[status] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Recent Imports</h2>
          {stats.recentImports.length === 0 ? (
            <p className="text-sm text-caption">No imports yet. Upload a PDF or CSV to get started.</p>
          ) : (
            <ul className="import-list">
              {stats.recentImports.map((batch) => (
                <li key={batch.id} className="import-list-item">
                  <div>
                    <p className="text-sm font-medium text-primary">{batch.filename}</p>
                    <p className="text-xs text-caption">
                      {batch.client?.name ?? "All clubs"} · {batch.type} · {batch.successCount} rows
                    </p>
                  </div>
                  <span className="text-xs text-caption">
                    {formatDateTime(batch.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
