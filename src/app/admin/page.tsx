import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { getDashboardStats } from "@/lib/orders";
import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABELS, OrderStatusValue } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const [stats, clients] = await Promise.all([
    getDashboardStats(),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    stats.statusCounts.map((s) => [s.status, s.count])
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of all pro club orders and recent activity"
        action={
          <div className="flex gap-2">
            <Link href="/admin/imports/csv" className="btn-primary">
              Weekly CSV
            </Link>
            <Link href="/admin/imports/pdf" className="btn-secondary">
              In-House PDF
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard label="Overdue Deliveries" value={stats.overdueOrders} hint="Past expected date" />
        <StatCard label="Active Clients" value={clients.length} />
        <StatCard label="Recent Imports" value={stats.recentImports.length} hint="Last 5 uploads" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Orders by Status</h2>
          <div className="space-y-3">
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatusValue[]).map((status) => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-sm font-medium text-slate-700">
                  {statusMap[status] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Imports</h2>
          {stats.recentImports.length === 0 ? (
            <p className="text-sm text-slate-500">No imports yet. Upload a PDF or CSV to get started.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentImports.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{batch.filename}</p>
                    <p className="text-xs text-slate-500">
                      {batch.client?.name ?? "All clubs"} · {batch.type} · {batch.successCount} rows
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
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
