import { Prisma } from "@prisma/client";

/** Days delivered orders stay visible on active client reports before archiving. */
export const DELIVERED_VISIBLE_DAYS = 14;

export function getDeliveredCutoff(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELIVERED_VISIBLE_DAYS);
  return cutoff;
}

export function buildActiveOrdersFilter(cutoff = getDeliveredCutoff()): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      {
        status: "DELIVERED",
        OR: [
          { deliveredAt: { gte: cutoff } },
          { deliveredAt: null, updatedAt: { gte: cutoff } },
        ],
      },
    ],
  };
}

export function buildArchivedDeliveredFilter(cutoff = getDeliveredCutoff()): Prisma.OrderWhereInput {
  return {
    status: "DELIVERED",
    OR: [
      { deliveredAt: { lt: cutoff } },
      { deliveredAt: null, updatedAt: { lt: cutoff } },
    ],
  };
}

export type OrderView = "active" | "delivered" | "all";

export function buildOrderViewFilter(view: OrderView): Prisma.OrderWhereInput {
  if (view === "active") return buildActiveOrdersFilter();
  if (view === "delivered") return buildArchivedDeliveredFilter();
  return {};
}
