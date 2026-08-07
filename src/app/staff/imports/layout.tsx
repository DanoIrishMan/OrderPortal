import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function StaffImportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user || session.user.staffRole !== "ACCOUNT_MANAGER") {
    redirect("/staff/pathways");
  }

  return children;
}
