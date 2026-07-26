"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_STATUS_LABELS, OrderStatusValue } from "@/lib/constants";
import { formatDate, formatSectionLabel } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  section: string | null;
  orderDate: string | null;
  description: string | null;
  quantity: number | null;
  totalPrice: number | null;
  status: OrderStatusValue;
  expectedDeliveryDate: string | null;
  updatedAt: string;
}

type OrderView = "active" | "delivered";

export default function PortalPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrderView>("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("view", view);

    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [status, search, view]);

  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const openOrders = orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
  ).length;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.user?.clientName ?? "Club Member"}`}
        description={
          view === "active"
            ? "View your active orders and recently delivered items"
            : "Browse archived delivered orders"
        }
        action={
          view === "active" ? (
            <Link href="/portal/export" className="btn-primary">
              Download Report
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setView("active")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === "active"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          My Orders
        </button>
        <button
          type="button"
          onClick={() => setView("delivered")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === "delivered"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Delivered Orders
        </button>
      </div>

      {view === "active" && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Visible Orders" value={orders.length} />
          <StatCard label="Open Orders" value={openOrders} />
          <StatCard label="In Production" value={statusCounts["IN_PRODUCTION"] ?? 0} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          className="input max-w-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatusValue[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          className="input max-w-sm"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Section</th>
              <th>Date</th>
              <th>Description</th>
              <th>Total</th>
              <th>Expected Delivery</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  {view === "active" ? "No active orders" : "No archived delivered orders"}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-medium text-slate-900">{order.orderNumber}</td>
                  <td>{formatSectionLabel(order.section, session?.user?.clientName) || "—"}</td>
                  <td>{formatDate(order.orderDate ? new Date(order.orderDate) : null)}</td>
                  <td className="max-w-xs truncate">{order.description || "—"}</td>
                  <td>{order.quantity ?? "—"}</td>
                  <td>
                    {formatDate(
                      order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null
                    ) || "—"}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
