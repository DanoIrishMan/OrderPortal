import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "STAFF") {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/portal");
  }

  return (
    <>
      <NavBar session={session} />
      <main className="app-main">{children}</main>
    </>
  );
}
