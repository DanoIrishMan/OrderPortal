"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_STATUSES, OrderStatusValue } from "@/lib/constants";
import { formatCurrency, formatDate, formatSectionLabel } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  section: string | null;
  orderDate: string | null;
  poNumber: string | null;
  description: string | null;
  totalPrice: number | null;
  status: OrderStatusValue;
  client: { name: string };
}

type OrderView = "active" | "delivered";

export default function OrdersPageClient() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrderView>("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("view", view);

    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then(setOrders);
  }, [clientId, status, search, view]);

  async function handleCompleteToggle(order: Order, checked: boolean) {
    setUpdatingId(order.id);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markComplete: checked }),
    });

    if (res.ok) {
      const updated = await res.json();
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, ...updated } : item))
      );
    }

    setUpdatingId(null);
  }

  return (
    <div>
      <PageHeader title="Orders" description="Search and manage all client orders" />

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
          Active Orders
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

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Search order #, PO, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {view === "active" && <th>Order complete</th>}
              <th>Order #</th>
              <th>Client</th>
              <th>Section</th>
              <th>Date</th>
              <th>Description</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={view === "active" ? 8 : 7} className="py-8 text-center text-slate-500">
                  No orders found
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  {view === "active" && (
                    <td>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={order.status === "DELIVERED"}
                          disabled={updatingId === order.id}
                          onChange={(e) => handleCompleteToggle(order, e.target.checked)}
                          className="rounded"
                        />
                        Order complete
                      </label>
                    </td>
                  )}
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.client.name}</td>
                  <td>{formatSectionLabel(order.section, order.client.name) || "—"}</td>
                  <td>{formatDate(order.orderDate ? new Date(order.orderDate) : null)}</td>
                  <td className="max-w-xs truncate">{order.description}</td>
                  <td>{formatCurrency(order.totalPrice)}</td>
                  <td>
                    <StatusBadge status={order.status} />
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
