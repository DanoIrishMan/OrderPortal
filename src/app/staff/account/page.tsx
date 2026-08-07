import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function StaffAccountPage() {
  return (
    <div>
      <PageHeader
        title="Change Password"
        description="Update your staff login credentials"
        action={
          <Link href="/staff/pathways" className="btn-secondary">
            Back to tasks
          </Link>
        }
      />

      <div className="card max-w-lg">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
