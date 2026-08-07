"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EditUserDialog } from "@/components/EditUserDialog";

type AccountType = "ADMIN" | "ACCOUNT_MANAGER" | "DESIGNER";

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF" | "CLIENT";
  staffRole: "ACCOUNT_MANAGER" | "DESIGNER" | null;
  createdAt: string;
  managedClients?: Array<{ id: string; name: string }>;
}

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "ADMIN", label: "Admin" },
  { value: "ACCOUNT_MANAGER", label: "Account Manager" },
  { value: "DESIGNER", label: "Designer" },
];

function accountTypeLabel(user: PortalUser): string {
  if (user.role === "ADMIN") return "Admin";
  if (user.staffRole === "ACCOUNT_MANAGER") return "Account Manager";
  if (user.staffRole === "DESIGNER") return "Designer";
  return "Staff";
}

function accountTypeSortOrder(user: PortalUser): number {
  if (user.role === "ADMIN") return 0;
  if (user.staffRole === "ACCOUNT_MANAGER") return 1;
  if (user.staffRole === "DESIGNER") return 2;
  return 3;
}

function toApiPayload(accountType: AccountType, form: FormData) {
  const base = {
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  };

  if (accountType === "ADMIN") {
    return { ...base, role: "ADMIN" };
  }

  return {
    ...base,
    role: "STAFF",
    staffRole: accountType,
  };
}

export function UsersManagementForm() {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("ADMIN");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers((data ?? []).filter((user: PortalUser) => user.role !== "CLIENT"));
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          accountTypeSortOrder(a) - accountTypeSortOrder(b) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [users]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiPayload(accountType, form)),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Failed to add user");
      return;
    }

    e.currentTarget.reset();
    setMessage("User added");
    loadUsers();
  }

  async function handleDelete(user: PortalUser) {
    if (!confirm(`Remove ${user.name}?`)) return;

    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to remove user");
      return;
    }

    setMessage("User removed");
    loadUsers();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="accountType" className="mb-1 block text-sm font-medium text-slate-700">
              Account type
            </label>
            <select
              id="accountType"
              name="accountType"
              className="input"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              required
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="userName" className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input id="userName" name="name" className="input" required />
          </div>
          <div>
            <label htmlFor="userEmail" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input id="userEmail" name="email" type="email" className="input" required />
          </div>
          <div>
            <label htmlFor="userPassword" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="userPassword"
              name="password"
              type="password"
              className="input"
              minLength={6}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Adding..." : "Add User"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </form>

      <div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading users...</p>
        ) : sortedUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No users yet</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {sortedUsers.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">
                    {user.email} · {accountTypeLabel(user)}
                    {user.staffRole === "ACCOUNT_MANAGER" && user.managedClients && (
                      <>
                        {" "}
                        · {user.managedClients.length} client
                        {user.managedClients.length === 1 ? "" : "s"}
                        {user.managedClients.length > 0 &&
                          `: ${user.managedClients.map((client) => client.name).join(", ")}`}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(user)}
                    className="text-sm font-medium text-slate-700 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setMessage(`Updated ${editingUser.name}`);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
