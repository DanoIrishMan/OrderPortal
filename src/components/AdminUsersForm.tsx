"use client";

import { FormEvent, useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CLIENT";
  createdAt: string;
}

export function AdminUsersForm() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdmins() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setAdmins((data ?? []).filter((user: AdminUser) => user.role === "ADMIN"));
    setLoading(false);
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: "ADMIN",
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Failed to add admin user");
      return;
    }

    e.currentTarget.reset();
    setMessage("Admin user added");
    loadAdmins();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this admin user?")) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to delete admin user");
      return;
    }

    setMessage("Admin user removed");
    loadAdmins();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="adminName" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input id="adminName" name="name" className="input" required />
        </div>
        <div>
          <label htmlFor="adminEmail" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="adminEmail" name="email" type="email" className="input" required />
        </div>
        <div>
          <label htmlFor="adminPassword" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="adminPassword"
            name="password"
            type="password"
            className="input"
            minLength={6}
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Adding..." : "Add Admin User"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </form>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Current admin users</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-500">No admin users found</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {admins.map((admin) => (
              <li key={admin.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{admin.name}</p>
                  <p className="text-xs text-slate-500">{admin.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(admin.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
