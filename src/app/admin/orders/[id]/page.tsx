"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, OrderStatusValue } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface OrderEvent {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  section: string | null;
  orderDate: string | null;
  poNumber: string | null;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  status: OrderStatusValue;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  notes: string | null;
  client: { name: string };
  events: OrderEvent[];
  importBatch: { filename: string; type: string; createdAt: string } | null;
  updatedAt: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const body = {
      orderNumber: form.get("orderNumber"),
      section: form.get("section") || null,
      orderDate: form.get("orderDate") || null,
      poNumber: form.get("poNumber") || null,
      description: form.get("description") || null,
      quantity: form.get("quantity") ? Number(form.get("quantity")) : null,
      unitPrice: form.get("unitPrice") ? Number(form.get("unitPrice")) : null,
      totalPrice: form.get("totalPrice") ? Number(form.get("totalPrice")) : null,
      status: form.get("status"),
      expectedDeliveryDate: form.get("expectedDeliveryDate") || null,
      actualDeliveryDate: form.get("actualDeliveryDate") || null,
      notes: form.get("notes") || null,
    };

    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      const updated = await fetch(`/api/orders/${id}`).then((r) => r.json());
      setOrder(updated);
      router.refresh();
    }
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!order) return <p className="text-red-600">Order not found</p>;

  return (
    <div>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`${order.client.name} · Last updated ${formatDateTime(new Date(order.updatedAt))}`}
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="card space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Order Number</label>
              <input name="orderNumber" className="input" defaultValue={order.orderNumber} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Order Date</label>
              <input
                name="orderDate"
                type="date"
                className="input"
                defaultValue={formatDate(order.orderDate ? new Date(order.orderDate) : null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Section</label>
              <input
                name="section"
                className="input"
                placeholder="e.g. Shop, Mens Team, NLU"
                defaultValue={order.section ?? ""}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">PO Number</label>
              <input name="poNumber" className="input" defaultValue={order.poNumber ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select name="status" className="input" defaultValue={order.status}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea name="description" className="input" rows={2} defaultValue={order.description ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
              <input name="quantity" type="number" className="input" defaultValue={order.quantity ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Unit Price</label>
              <input name="unitPrice" type="number" step="0.01" className="input" defaultValue={order.unitPrice ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Total Price</label>
              <input name="totalPrice" type="number" step="0.01" className="input" defaultValue={order.totalPrice ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Expected Delivery</label>
              <input
                name="expectedDeliveryDate"
                type="date"
                className="input"
                defaultValue={formatDate(order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Actual Delivery</label>
              <input
                name="actualDeliveryDate"
                type="date"
                className="input"
                defaultValue={formatDate(order.actualDeliveryDate ? new Date(order.actualDeliveryDate) : null)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea name="notes" className="input" rows={3} defaultValue={order.notes ?? ""} />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link href="/admin/orders" className="btn-secondary">
              Back to Orders
            </Link>
          </div>
        </form>

        <div className="space-y-6">
          {order.importBatch && (
            <div className="card">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Import Source</h3>
              <p className="text-sm text-slate-600">{order.importBatch.filename}</p>
              <p className="text-xs text-slate-400">
                {order.importBatch.type} · {formatDateTime(new Date(order.importBatch.createdAt))}
              </p>
            </div>
          )}

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Change History</h3>
            {order.events.length === 0 ? (
              <p className="text-sm text-slate-500">No changes recorded yet</p>
            ) : (
              <ul className="space-y-3">
                {order.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{event.field}</span>:{" "}
                      {event.oldValue || "—"} → {event.newValue || "—"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(new Date(event.createdAt))} · {event.source}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
