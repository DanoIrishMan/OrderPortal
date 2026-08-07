import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/DashboardOverview";
import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/orders";
import { prisma } from "@/lib/db";

export default async function StaffDashboardPage() {
  const session = await getSession();

  if (!session?.user || session.user.role !== "STAFF") {
    redirect("/login");
  }

  if (session.user.staffRole !== "ACCOUNT_MANAGER") {
    redirect("/staff/pathways");
  }

  const [stats, clients] = await Promise.all([
    getDashboardStats({ accountManagerId: session.user.id }),
    prisma.client.findMany({
      where: { accountManagerId: session.user.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DashboardOverview
      stats={stats}
      activeClients={clients.length}
      description="Overview of orders and recent activity for your assigned clients"
      uploadBasePath="/staff/imports"
    />
  );
}
