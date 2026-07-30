export const ORDER_STATUSES = [
  "RECEIVED",
  "AWAITING_ARTWORK",
  "WITH_SUPPLIER",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export type DisplayOrderStatus = OrderStatusValue | "DELAYED";

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  RECEIVED: "Received",
  AWAITING_ARTWORK: "Awaiting Artwork",
  WITH_SUPPLIER: "With Supplier",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const DISPLAY_STATUS_LABELS: Record<DisplayOrderStatus, string> = {
  ...ORDER_STATUS_LABELS,
  DELAYED: "Delayed",
};

export const DISPLAY_STATUS_ORDER: DisplayOrderStatus[] = [
  ...ORDER_STATUSES,
  "DELAYED",
];

export const EXPORT_COLUMNS = [
  { key: "orderNumber", header: "Order Number" },
  { key: "section", header: "Section" },
  { key: "orderDate", header: "Order Date" },
  { key: "poNumber", header: "PO Number" },
  { key: "description", header: "Description" },
  { key: "quantity", header: "Quantity" },
  { key: "unitPrice", header: "Unit Price" },
  { key: "totalPrice", header: "Total Price" },
  { key: "status", header: "Status" },
  { key: "expectedDeliveryDate", header: "Date Required" },
  { key: "leavingOsFactoryDate", header: "Leaving OS Factory" },
  { key: "actualDeliveryDate", header: "Actual Delivery" },
  { key: "notes", header: "Notes" },
  { key: "lastUpdated", header: "Last Updated" },
] as const;

export const CSV_FIELD_OPTIONS = [
  { key: "orderNumber", label: "Order Number", required: true },
  { key: "orderDate", label: "Order Date", required: false },
  { key: "poNumber", label: "PO Number", required: false },
  { key: "description", label: "Description", required: false },
  { key: "quantity", label: "Quantity", required: false },
  { key: "unitPrice", label: "Unit Price", required: false },
  { key: "totalPrice", label: "Total Price", required: false },
  { key: "status", label: "Status", required: false },
  { key: "expectedDeliveryDate", label: "Date Required", required: false },
  { key: "leavingOsFactoryDate", label: "Leaving OS Factory", required: false },
  { key: "actualDeliveryDate", label: "Actual Delivery Date", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

export const STATUS_ALIASES: Record<string, OrderStatusValue> = {
  received: "RECEIVED",
  new: "RECEIVED",
  pending: "RECEIVED",
  "awaiting artwork": "AWAITING_ARTWORK",
  artwork: "AWAITING_ARTWORK",
  "with supplier": "WITH_SUPPLIER",
  supplier: "WITH_SUPPLIER",
  "in production": "IN_PRODUCTION",
  production: "IN_PRODUCTION",
  processing: "IN_PRODUCTION",
  "sent offshore": "WITH_SUPPLIER",
  offshore: "WITH_SUPPLIER",
  "cut work": "IN_PRODUCTION",
  cutwork: "IN_PRODUCTION",
  shipped: "SHIPPED",
  dispatched: "SHIPPED",
  delivered: "DELIVERED",
  complete: "DELIVERED",
  completed: "DELIVERED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};
