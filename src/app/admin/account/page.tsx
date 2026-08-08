import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AdminAccountPage() {
  return (
    <div>
      <PageHeader
        title="Change Password"
        description="Update your admin login credentials"
        action={
          <Link href="/admin" className="btn-secondary">
            Back to dashboard
          </Link>
        }
      />

      <div className="card max-w-lg">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
