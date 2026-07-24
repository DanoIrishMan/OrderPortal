"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { OrderStatusValue } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface OrderEvent {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
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
  events: OrderEvent[];
  updatedAt: string;
}

export default function PortalOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!order) return <p className="text-red-600">Order not found</p>;

  return (
    <div>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Last updated ${formatDateTime(new Date(order.updatedAt))}`}
        action={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500">Order Date</dt>
              <dd className="text-sm text-slate-900">
                {formatDate(order.orderDate ? new Date(order.orderDate) : null) || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">PO Number</dt>
              <dd className="text-sm text-slate-900">{order.poNumber || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Description</dt>
              <dd className="text-sm text-slate-900">{order.description || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Quantity</dt>
              <dd className="text-sm text-slate-900">{order.quantity ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Total</dt>
              <dd className="text-sm text-slate-900">{formatCurrency(order.totalPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Expected Delivery</dt>
              <dd className="text-sm text-slate-900">
                {formatDate(order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null) || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Actual Delivery</dt>
              <dd className="text-sm text-slate-900">
                {formatDate(order.actualDeliveryDate ? new Date(order.actualDeliveryDate) : null) || "—"}
              </dd>
            </div>
            {order.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Notes</dt>
                <dd className="text-sm text-slate-900">{order.notes}</dd>
              </div>
            )}
          </dl>

          <Link href="/portal" className="btn-secondary inline-flex">
            Back to Orders
          </Link>
        </div>

        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Recent Updates</h3>
          {order.events.length === 0 ? (
            <p className="text-sm text-slate-500">No updates recorded yet</p>
          ) : (
            <ul className="space-y-3">
              {order.events.map((event) => (
                <li key={event.id} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{event.field}</span>:{" "}
                    {event.oldValue || "—"} → {event.newValue || "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(new Date(event.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
