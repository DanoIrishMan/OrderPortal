"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

interface CustomerAlias {
  id: string;
  csvCustomerName: string;
  createdAt: string;
}

interface ClientDetail {
  id: string;
  name: string;
  contactEmail: string;
  active: boolean;
  accountManagerId: string | null;
  accountManager: { id: string; name: string } | null;
  users: Array<{ id: string; email: string; name: string }>;
  _count: { orders: number };
}

interface StaffOption {
  id: string;
  name: string;
  staffRole: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [accountManagers, setAccountManagers] = useState<StaffOption[]>([]);
  const [aliases, setAliases] = useState<CustomerAlias[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aliasSaving, setAliasSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadClient() {
    const res = await fetch(`/api/clients/${id}`);
    return res.json() as Promise<ClientDetail>;
  }

  async function loadAliases() {
    const res = await fetch(`/api/clients/${id}/customer-aliases`);
    if (!res.ok) return [];
    return res.json() as Promise<CustomerAlias[]>;
  }

  useEffect(() => {
    Promise.all([
      loadClient(),
      loadAliases(),
      fetch("/api/users")
        .then((r) => r.json())
        .then((users) =>
          setAccountManagers(
            (users ?? []).filter(
              (u: StaffOption & { role: string }) =>
                u.role === "STAFF" && u.staffRole === "ACCOUNT_MANAGER"
            )
          )
        ),
    ])
      .then(([clientData, aliasData]) => {
        setClient(clientData);
        setAliases(aliasData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      contactEmail: form.get("contactEmail"),
      active: form.get("active") === "on",
      accountManagerId: form.get("accountManagerId") || null,
      userEmail: form.get("userEmail") || undefined,
      userName: form.get("userName") || undefined,
      userPassword: form.get("userPassword") || undefined,
    };

    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update");
      return;
    }

    const full = await loadClient();
    setClient(full);
    router.refresh();
  }

  async function handleAddAlias(e: FormEvent) {
    e.preventDefault();
    const name = newAlias.trim();
    if (!name) return;

    setAliasSaving(true);
    setError("");

    const res = await fetch(`/api/clients/${id}/customer-aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvCustomerName: name }),
    });

    setAliasSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add alias");
      return;
    }

    setNewAlias("");
    setAliases(await loadAliases());
  }

  async function handleDeleteAlias(aliasId: string) {
    if (!confirm("Remove this CSV customer mapping?")) return;

    const res = await fetch(`/api/clients/${id}/customer-aliases?aliasId=${aliasId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete alias");
      return;
    }

    setAliases(await loadAliases());
  }

  async function handleDelete() {
    if (!confirm("Delete this client and all their orders? This cannot be undone.")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    router.push("/admin/clients");
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!client) return <p className="text-red-600">Client not found</p>;

  return (
    <div>
      <PageHeader
        title={client.name}
        description={`${client._count.orders} orders · ${client.users.length} portal user(s)`}
        action={
          <Link href={`/admin/orders?clientId=${client.id}`} className="btn-secondary">
            View Orders
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Club Name</label>
            <input name="name" className="input" defaultValue={client.name} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Contact Email</label>
            <input
              name="contactEmail"
              type="email"
              className="input"
              defaultValue={client.contactEmail}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Manager</label>
            <select
              name="accountManagerId"
              className="input"
              defaultValue={client.accountManagerId ?? ""}
            >
              <option value="">Not assigned</option>
              {accountManagers.map((am) => (
                <option key={am.id} value={am.id}>
                  {am.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              The assigned account manager can view this client&apos;s orders in the staff portal.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="active" type="checkbox" defaultChecked={client.active} className="rounded" />
              Active client
            </label>
          </div>
        </div>

        {client.users.length > 0 && (
          <div className="rounded-lg bg-slate-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Existing Portal Users</h3>
            <ul className="space-y-1 text-sm text-slate-600">
              {client.users.map((u) => (
                <li key={u.id}>
                  {u.name} ({u.email})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-slate-200 pt-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Add or Update Portal User</h3>
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
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" className="btn-secondary text-red-600" onClick={handleDelete}>
            Delete Client
          </button>
        </div>
      </form>

      <div className="card max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">CSV Customer Aliases</h2>
          <p className="mt-1 text-sm text-slate-600">
            Each CSV customer name from production maps to this club. One customer name = one club
            (e.g. ECOM is separate from Shelbourne FC Shop even when ordering similar products).
          </p>
        </div>

        {aliases.length > 0 ? (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {aliases.map((alias) => (
              <li
                key={alias.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-900">{alias.csvCustomerName}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteAlias(alias.id)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No aliases configured yet.</p>
        )}

        <form onSubmit={handleAddAlias} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder='e.g. "Shelbourne FC Shop"'
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
          />
          <button type="submit" className="btn-secondary" disabled={aliasSaving || !newAlias.trim()}>
            {aliasSaving ? "Adding..." : "Add Alias"}
          </button>
        </form>
      </div>
    </div>
  );
}
