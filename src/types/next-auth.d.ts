import "next-auth";
import type { StaffRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "ADMIN" | "STAFF" | "CLIENT";
      staffRole: StaffRole | null;
      clientId: string | null;
      clientName: string | null;
    };
  }

  interface User {
    role: "ADMIN" | "STAFF" | "CLIENT";
    staffRole: StaffRole | null;
    clientId: string | null;
    clientName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "STAFF" | "CLIENT";
    staffRole?: StaffRole | null;
    clientId?: string | null;
    clientName?: string | null;
  }
}
