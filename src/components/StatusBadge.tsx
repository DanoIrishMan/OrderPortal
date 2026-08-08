import { DISPLAY_STATUS_LABELS, DisplayOrderStatus, OrderStatusValue } from "@/lib/constants";

const statusColors: Record<DisplayOrderStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700 ring-slate-200",
  AWAITING_ARTWORK: "bg-amber-50 text-amber-800 ring-amber-200",
  WITH_SUPPLIER: "bg-orange-50 text-orange-800 ring-orange-200",
  IN_PRODUCTION: "bg-blue-50 text-blue-800 ring-blue-200",
  SHIPPED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-800 ring-red-200",
  DELAYED: "bg-red-50 text-red-800 ring-red-200",
};

export function StatusBadge({ status }: { status: DisplayOrderStatus | OrderStatusValue }) {
  const displayStatus = status as DisplayOrderStatus;

  return (
    <span className={`status-badge ${statusColors[displayStatus]}`}>
      {DISPLAY_STATUS_LABELS[displayStatus]}
    </span>
  );
}
