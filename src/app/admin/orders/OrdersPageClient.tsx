"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DISPLAY_STATUS_ORDER, DISPLAY_STATUS_LABELS, OrderStatusValue } from "@/lib/constants";
import { formatDate, formatSectionLabel, getDisplayStatus } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  section: string | null;
  orderDate: string | null;
  leavingOsFactoryDate: string | null;
  expectedDeliveryDate: string | null;
  poNumber: string | null;
  description: string | null;
  quantity: number | null;
  totalPrice: number | null;
  status: OrderStatusValue;
  client: { name: string };
}

type OrderView = "all" | "active" | "delivered";

export default function OrdersPageClient() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrderView>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  useEffect(() => {
    setSection("");
    if (!clientId) {
      setSections([]);
      return;
    }

    fetch(`/api/orders/sections?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((data) => setSections(Array.isArray(data.sections) ? data.sections : []))
      .catch(() => setSections([]));
  }, [clientId]);

  useEffect(() => {
    setLoadError("");
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (section) params.set("section", section);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("view", view);

    fetch(`/api/orders?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "Failed to load orders");
          setOrders([]);
          return;
        }
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setLoadError("Failed to load orders");
        setOrders([]);
      });
  }, [clientId, section, status, search, view]);

  async function handleCompleteToggle(order: Order, checked: boolean) {
    setUpdatingId(order.id);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markComplete: checked }),
    });

    if (res.ok) {
      const updated = await res.json();
      if (view === "active" && checked) {
        setOrders((current) => current.filter((item) => item.id !== order.id));
      } else {
        setOrders((current) =>
          current.map((item) => (item.id === order.id ? { ...item, ...updated } : item))
        );
      }
    }

    setUpdatingId(null);
  }

  return (
    <div>
      <PageHeader title="Orders" description="Search and manage all client orders" />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("all")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All Orders
        </button>
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

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className={`mb-6 grid gap-3 ${clientId ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {clientId && (
          <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">All sections</option>
            {sections.map((value) => {
              const clientName = clients.find((c) => c.id === clientId)?.name;
              return (
                <option key={value} value={value}>
                  {formatSectionLabel(value, clientName) || value}
                </option>
              );
            })}
          </select>
        )}
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {DISPLAY_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {DISPLAY_STATUS_LABELS[s]}
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
              <th>Date Ordered</th>
              <th>Leaving OS Factory</th>
              <th>Date Required</th>
              <th>Description</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={view === "active" ? 10 : 9} className="py-8 text-center text-slate-500">
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
                  <td>
                    {formatDate(
                      order.leavingOsFactoryDate ? new Date(order.leavingOsFactoryDate) : null
                    ) || "—"}
                  </td>
                  <td>
                    {formatDate(
                      order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null
                    ) || "—"}
                  </td>
                  <td className="max-w-xs truncate">{order.description}</td>
                  <td>{order.quantity ?? "—"}</td>
                  <td>
                    <StatusBadge status={getDisplayStatus(order)} />
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
