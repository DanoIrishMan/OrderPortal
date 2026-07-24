import { ORDER_STATUS_LABELS, OrderStatusValue } from "@/lib/constants";

const statusColors: Record<OrderStatusValue, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  AWAITING_ARTWORK: "bg-amber-100 text-amber-800",
  WITH_SUPPLIER: "bg-orange-100 text-orange-800",
  IN_PRODUCTION: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: OrderStatusValue }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
