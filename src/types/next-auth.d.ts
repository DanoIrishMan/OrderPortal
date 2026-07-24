import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "ADMIN" | "CLIENT";
      clientId: string | null;
      clientName: string | null;
    };
  }

  interface User {
    role: "ADMIN" | "CLIENT";
    clientId: string | null;
    clientName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "CLIENT";
    clientId?: string | null;
    clientName?: string | null;
  }
}
