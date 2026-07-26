import { Prisma } from "@prisma/client";

/** Days delivered orders stay visible on active client reports before archiving. */
export const DELIVERED_VISIBLE_DAYS = 14;

export function getDeliveredCutoff(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELIVERED_VISIBLE_DAYS);
  return cutoff;
}

/**
 * Active = open orders plus delivered orders still within the 2-week window.
 * Uses actualDeliveryDate (falls back to updatedAt) so filtering works even
 * before deliveredAt is backfilled on older rows.
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

/** Archived delivered orders older than the 2-week visibility window. */
export function buildArchivedDeliveredFilter(cutoff = getDeliveredCutoff()): Prisma.OrderWhereInput {
  return {
    status: "DELIVERED",
    OR: [
      { actualDeliveryDate: { lt: cutoff } },
      { actualDeliveryDate: null, updatedAt: { lt: cutoff } },
    ],
  };
}

export type OrderView = "active" | "delivered" | "all";

export function buildOrderViewFilter(view: OrderView): Prisma.OrderWhereInput {
  if (view === "active") return buildActiveOrdersFilter();
  if (view === "delivered") return buildArchivedDeliveredFilter();
  return {};
}
