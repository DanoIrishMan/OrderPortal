import { PageHeader } from "@/components/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AccountPage() {
  return (
    <div>
      <PageHeader
        title="Account"
        description="Manage your login credentials"
      />

      <div className="card max-w-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
