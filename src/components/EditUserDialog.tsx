"use client";

import { useEffect, useState } from "react";

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF" | "CLIENT";
  staffRole: "ACCOUNT_MANAGER" | "DESIGNER" | null;
}

interface ClientOption {
  id: string;
  name: string;
  accountManagerId: string | null;
}

interface EditUserDialogProps {
  user: PortalUser;
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserDialog({ user, onClose, onSaved }: EditUserDialogProps) {
  const isAccountManager = user.role === "STAFF" && user.staffRole === "ACCOUNT_MANAGER";
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        if (isAccountManager) {
          const [clientsRes, userRes] = await Promise.all([
            fetch("/api/clients"),
            fetch(`/api/users/${user.id}`),
          ]);

          const clientsData = await clientsRes.json();
          const userData = await userRes.json();

          if (!clientsRes.ok) {
            throw new Error(clientsData.error || "Failed to load clients");
          }
          if (!userRes.ok) {
            throw new Error(userData.error || "Failed to load user");
          }

          setClients(
            (clientsData ?? [])
              .filter((client: ClientOption & { active?: boolean }) => client.active !== false)
              .map((client: ClientOption) => ({
                id: client.id,
                name: client.name,
                accountManagerId: client.accountManagerId ?? null,
              }))
              .sort((a: ClientOption, b: ClientOption) => a.name.localeCompare(b.name))
          );
          setSelectedClientIds(
            (userData.managedClients ?? []).map((client: { id: string }) => client.id)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user.id, isAccountManager]);

  function toggleClient(clientId: string) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    );
  }

  async function handleSave() {
    if (!isAccountManager) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: selectedClientIds }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Failed to save client assignments");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit {user.name}</h2>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : isAccountManager ? (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Assigned clients</h3>
              <p className="mb-3 text-sm text-slate-600">
                Select the clients this account manager can view orders and manage tasks for.
              </p>
              {clients.length === 0 ? (
                <p className="text-sm text-slate-500">No active clients found.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {clients.map((client) => {
                    const assignedElsewhere =
                      client.accountManagerId &&
                      client.accountManagerId !== user.id &&
                      !selectedClientIds.includes(client.id);

                    return (
                      <li key={client.id}>
                        <label className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedClientIds.includes(client.id)}
                            onChange={() => toggleClient(client.id)}
                            className="mt-0.5 rounded"
                          />
                          <span>
                            <span className="font-medium text-slate-900">{client.name}</span>
                            {assignedElsewhere && (
                              <span className="mt-0.5 block text-xs text-amber-700">
                                Currently assigned to another account manager
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Client assignment only applies to Account Managers. Designers are linked to clients
            through Critical Pathways.
          </p>
        )}
      </div>
    </div>
  );
}
