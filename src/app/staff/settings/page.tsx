import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { WeeklyExportSettings } from "@/components/WeeklyExportSettings";
import { getSession } from "@/lib/auth";

export default async function StaffSettingsPage() {
  const session = await getSession();

  if (!session?.user || session.user.staffRole !== "ACCOUNT_MANAGER") {
    redirect("/staff/pathways");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and weekly export schedules for assigned clients"
        action={
          <Link href="/staff/account" className="text-sm font-medium text-slate-700 hover:underline">
            Change password
          </Link>
        }
      />

      <WeeklyExportSettings emptyClientsMessage="No clients assigned to you yet" />
    </div>
  );
}
