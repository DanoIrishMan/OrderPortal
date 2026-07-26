import { Prisma } from "@prisma/client";

/** Days delivered orders stay visible on active client reports before archiving. */
export const DELIVERED_VISIBLE_DAYS = 14;

export function getDeliveredCutoff(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELIVERED_VISIBLE_DAYS);
  return cutoff;
}

/**
 * Client portal: open orders plus delivered orders still within the 2-week window.
 */
export function buildActiveOrdersFilter(cutoff = getDeliveredCutoff()): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      {
        status: "DELIVERED",
        OR: [
          { actualDeliveryDate: { gte: cutoff } },
          { actualDeliveryDate: null, updatedAt: { gte: cutoff } },
        ],
      },
    ],
  };
}

/** Client portal: delivered orders older than the 2-week visibility window. */
export function buildArchivedDeliveredFilter(cutoff = getDeliveredCutoff()): Prisma.OrderWhereInput {
  return {
    status: "DELIVERED",
    OR: [
      { actualDeliveryDate: { lt: cutoff } },
      { actualDeliveryDate: null, updatedAt: { lt: cutoff } },
    ],
  };
}

/** Admin: in-progress orders only (not yet delivered). */
export function buildAdminActiveOrdersFilter(): Prisma.OrderWhereInput {
  return { status: { notIn: ["DELIVERED", "CANCELLED"] } };
}

/** Admin: all delivered orders. */
export function buildAdminDeliveredOrdersFilter(): Prisma.OrderWhereInput {
  return { status: "DELIVERED" };
}

export type OrderView = "active" | "delivered" | "all";

export function buildOrderViewFilter(
  view: OrderView,
  audience: "admin" | "client" = "client"
): Prisma.OrderWhereInput {
  if (view === "all") return {};
  if (view === "active") {
    return audience === "admin" ? buildAdminActiveOrdersFilter() : buildActiveOrdersFilter();
  }
  if (view === "delivered") {
    return audience === "admin" ? buildAdminDeliveredOrdersFilter() : buildArchivedDeliveredFilter();
  }
  return {};
}
