import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true, users: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage pro club accounts and portal users"
        action={
          <Link href="/admin/clients/new" className="btn-primary">
            Add Client
          </Link>
        }
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Club Name</th>
              <th>Contact Email</th>
              <th>Orders</th>
              <th>Users</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="font-medium text-slate-900">{client.name}</td>
                <td>{client.contactEmail}</td>
                <td>{client._count.orders}</td>
                <td>{client._count.users}</td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      client.active
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {client.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
