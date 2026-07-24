"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      contactEmail: form.get("contactEmail"),
      active: form.get("active") === "on",
      userEmail: form.get("userEmail") || undefined,
      userName: form.get("userName") || undefined,
      userPassword: form.get("userPassword") || undefined,
    };

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create client");
      return;
    }

    const client = await res.json();
    router.push(`/admin/clients/${client.id}`);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Add Client"
        description="Create a new pro club account and optional portal login"
      />

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Club Name</label>
            <input name="name" className="input" required />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Contact Email</label>
            <input name="contactEmail" type="email" className="input" required />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="active" type="checkbox" defaultChecked className="rounded" />
              Active client
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Portal User (optional)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">User Name</label>
              <input name="userName" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Login Email</label>
              <input name="userEmail" type="email" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input name="userPassword" type="password" className="input" minLength={6} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Client"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
