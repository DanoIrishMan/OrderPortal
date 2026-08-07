"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_ORDER,
  OrderStatusValue,
} from "@/lib/constants";
import { formatDate, formatSectionLabel, getDisplayStatus } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  section: string | null;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  description: string | null;
  quantity: number | null;
  status: OrderStatusValue;
  client: { name: string };
}

interface ClientOption {
  id: string;
  name: string;
}

type OrderView = "all" | "active" | "delivered";

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [section, setSection] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<OrderView>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/api/staff/clients")
      .then((r) => r.json())
      .then((data) => setClients(data.clients ?? []));
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
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    params.set("view", view);
    if (clientId) params.set("clientId", clientId);
    if (section) params.set("section", section);
    if (status) params.set("status", status);
    if (search) params.set("search", search);

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
      })
      .finally(() => setLoading(false));
  }, [clientId, section, status, search, view]);

  return (
    <div>
      <PageHeader
        title="Client Orders"
        description="Orders for clients assigned to you as Account Manager"
      />

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
          <option value="">All assigned clients</option>
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

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="card text-sm text-slate-600">No orders found for your assigned clients.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Client</th>
                <th>Section</th>
                <th>Date Ordered</th>
                <th>Date Required</th>
                <th>Description</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-medium">{order.orderNumber}</td>
                  <td>{order.client.name}</td>
                  <td>{formatSectionLabel(order.section, order.client.name) || "—"}</td>
                  <td>{formatDate(order.orderDate ? new Date(order.orderDate) : null)}</td>
                  <td>
                    {formatDate(
                      order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null
                    ) || "—"}
                  </td>
                  <td className="max-w-xs truncate">{order.description || "—"}</td>
                  <td>{order.quantity ?? "—"}</td>
                  <td>
                    <StatusBadge status={getDisplayStatus(order)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
