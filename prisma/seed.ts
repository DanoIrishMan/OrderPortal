import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** CSV customer names routed to Shelbourne FC (not ECOM — that is a separate client). */
const SHELBOURNE_ALIASES = [
  "Shelbourne FC Shop",
  "Shelbourne FC Mens Senior Team",
  "Shelbourne FC Womens",
  "Shelbourne Academy NLU",
];

const BOHEMIANS_ALIASES = ["Bohemians FC Shop Account"];

const ECOM_ALIASES = ["ECOM"];

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@portal.local" },
    update: {},
    create: {
      email: "admin@portal.local",
      name: "Portal Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  const shelbourne = await prisma.client.upsert({
    where: { id: "seed-shelbourne" },
    update: {},
    create: {
      id: "seed-shelbourne",
      name: "Shelbourne FC",
      contactEmail: "orders@shelbournefc.example",
      active: true,
    },
  });

  const bohemians = await prisma.client.upsert({
    where: { id: "seed-bohemians" },
    update: {},
    create: {
      id: "seed-bohemians",
      name: "Bohemians FC",
      contactEmail: "orders@bohemiansfc.example",
      active: true,
    },
  });

  const ecom = await prisma.client.upsert({
    where: { id: "seed-ecom" },
    update: {},
    create: {
      id: "seed-ecom",
      name: "ECOM",
      contactEmail: "orders@ecom.example",
      active: true,
    },
  });

  const clientPassword = await bcrypt.hash("client123", 10);

  await prisma.user.upsert({
    where: { email: "shelbourne@portal.local" },
    update: { clientId: shelbourne.id },
    create: {
      email: "shelbourne@portal.local",
      name: "Shelbourne Manager",
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: shelbourne.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "bohemians@portal.local" },
    update: { clientId: bohemians.id },
    create: {
      email: "bohemians@portal.local",
      name: "Bohemians Manager",
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: bohemians.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "ecom@portal.local" },
    update: { clientId: ecom.id },
    create: {
      email: "ecom@portal.local",
      name: "ECOM Manager",
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: ecom.id,
    },
  });

  const staffPassword = await bcrypt.hash("staff123", 10);

  const danielEnnis = await prisma.user.upsert({
    where: { email: "daniel.ennis@portal.local" },
    update: {},
    create: {
      email: "daniel.ennis@portal.local",
      name: "Daniel Ennis",
      passwordHash: staffPassword,
      role: "STAFF",
      staffRole: "ACCOUNT_MANAGER",
    },
  });

  await prisma.user.upsert({
    where: { email: "ken.johnston@portal.local" },
    update: {},
    create: {
      email: "ken.johnston@portal.local",
      name: "Ken Johnston",
      passwordHash: staffPassword,
      role: "STAFF",
      staffRole: "DESIGNER",
    },
  });

  await prisma.client.update({
    where: { id: bohemians.id },
    data: { accountManagerId: danielEnnis.id },
  });

  async function setAlias(csvCustomerName: string, clientId: string) {
    await prisma.customerAlias.upsert({
      where: { csvCustomerName },
      update: { clientId },
      create: { csvCustomerName, clientId },
    });
  }

  for (const csvCustomerName of SHELBOURNE_ALIASES) {
    await setAlias(csvCustomerName, shelbourne.id);
  }

  for (const csvCustomerName of BOHEMIANS_ALIASES) {
    await setAlias(csvCustomerName, bohemians.id);
  }

  for (const csvCustomerName of ECOM_ALIASES) {
    await setAlias(csvCustomerName, ecom.id);
  }

  // Move ECOM orders that were previously grouped under Shelbourne
  const misplacedEcom = await prisma.order.findMany({
    where: {
      clientId: shelbourne.id,
      OR: [{ section: "ECOM" }, { notes: { contains: "Customer: ECOM" } }],
    },
    select: { id: true, orderNumber: true },
  });

  for (const order of misplacedEcom) {
    const atEcom = await prisma.order.findUnique({
      where: {
        clientId_orderNumber: {
          clientId: ecom.id,
          orderNumber: order.orderNumber,
        },
      },
    });

    if (atEcom) {
      await prisma.order.delete({ where: { id: order.id } });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { clientId: ecom.id, section: "ECOM" },
      });
    }
  }

  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    await prisma.order.createMany({
      data: [
        {
          clientId: shelbourne.id,
          orderNumber: "DLES7818",
          section: "Shelbourne FC Shop",
          orderDate: new Date("2026-07-21"),
          description: "Shelbourne Home Jersey Replica 2026",
          quantity: 35,
          status: "IN_PRODUCTION",
          expectedDeliveryDate: new Date("2026-08-18"),
          source: "MANUAL",
        },
        {
          clientId: bohemians.id,
          orderNumber: "DLES7778",
          section: "Bohemians FC Shop Account",
          orderDate: new Date("2026-06-30"),
          description: "Bohs Thin Lizzy Jersey",
          quantity: 35,
          status: "IN_PRODUCTION",
          expectedDeliveryDate: new Date("2026-07-28"),
          source: "MANUAL",
        },
      ],
    });
  }

  console.log("Seed complete");
  console.log("Admin login: admin@portal.local / admin123");
  console.log(
    "Client logins: shelbourne@portal.local, bohemians@portal.local, ecom@portal.local / client123"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
