"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { UsersManagementForm } from "@/components/UsersManagementForm";
import { WeeklyExportSettings } from "@/components/WeeklyExportSettings";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage portal users and scheduled exports"
        action={
          <Link href="/admin/account" className="text-sm font-medium text-slate-700 hover:underline">
            Change password
          </Link>
        }
      />

      <div className="mb-6 card max-w-2xl">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Users</h2>
        <p className="mb-4 text-sm text-slate-600">
          Admins manage the portal. Account Managers and Designers work on Critical Pathways; Account
          Managers can also view orders for assigned clients.
        </p>
        <UsersManagementForm />
      </div>

      <WeeklyExportSettings showDryRun />
    </div>
  );
}
