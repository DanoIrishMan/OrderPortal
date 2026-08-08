import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/portal");
  }

  return (
    <>
      <NavBar session={session} />
      <main className="app-main">{children}</main>
    </>
  );
}
