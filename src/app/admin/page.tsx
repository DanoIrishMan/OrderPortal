import { DashboardOverview } from "@/components/DashboardOverview";
import { getDashboardStats } from "@/lib/orders";
import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [stats, clients] = await Promise.all([
    getDashboardStats(),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DashboardOverview
      stats={stats}
      activeClients={clients.length}
      description="Overview of all pro club orders and recent activity"
      uploadBasePath="/admin/imports"
    />
  );
}
