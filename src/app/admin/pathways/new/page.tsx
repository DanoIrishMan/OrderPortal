"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { STANDARD_PATHWAY_TASKS, getSubTaskTemplateForTitle } from "@/lib/pathway-templates";

interface Client {
  id: string;
  name: string;
  accountManagerId: string | null;
}

interface StaffUser {
  id: string;
  name: string;
  staffRole: "ACCOUNT_MANAGER" | "DESIGNER";
}

interface TaskRow {
  title: string;
  dueDate: string;
  subTasks: string[];
}

export default function NewPathwayPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [clientId, setClientId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [designerId, setDesignerId] = useState("");
  const [name, setName] = useState("Critical Pathway");
  const [tasks, setTasks] = useState<TaskRow[]>([{ title: "", dueDate: "", subTasks: [] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([clientData, userData]) => {
      setClients(clientData ?? []);
      setStaff(
        (userData ?? []).filter((u: StaffUser & { role: string }) => u.role === "STAFF")
      );
    });
  }, []);

  useEffect(() => {
    const client = clients.find((c) => c.id === clientId);
    if (client?.accountManagerId) {
      setAccountManagerId(client.accountManagerId);
    }
  }, [clientId, clients]);

  function loadTemplate() {
    setTasks(
      STANDARD_PATHWAY_TASKS.map((title) => ({
        title,
        dueDate: "",
        subTasks: getSubTaskTemplateForTitle(title),
      }))
    );
  }

  function updateTask(index: number, field: keyof TaskRow, value: string) {
    setTasks((current) =>
      current.map((task, i) => (i === index ? { ...task, [field]: value } : task))
    );
  }

  function addTask() {
    setTasks((current) => [...current, { title: "", dueDate: "", subTasks: [] }]);
  }

  function removeTask(index: number) {
    setTasks((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/pathways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        accountManagerId,
        designerId,
        name,
        tasks: tasks
          .filter((t) => t.title.trim() && t.dueDate)
          .map((task) => ({
            title: task.title,
            dueDate: task.dueDate,
            subTasks: task.subTasks
              .map((subTask) => subTask.trim())
              .filter(Boolean)
              .map((title) => ({ title })),
          })),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Failed to create pathway");
      return;
    }

    router.push(`/admin/pathways/${data.id}`);
  }

  const accountManagers = staff.filter((s) => s.staffRole === "ACCOUNT_MANAGER");
  const designers = staff.filter((s) => s.staffRole === "DESIGNER");

  return (
    <div>
      <PageHeader
        title="New Critical Pathway"
        description="Assign milestone tasks to an account manager and designer"
      />

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pathway name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account Manager</label>
            <select
              className="input"
              value={accountManagerId}
              onChange={(e) => setAccountManagerId(e.target.value)}
              required
            >
              <option value="">Select account manager</option>
              {accountManagers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Designer</label>
            <select
              className="input"
              value={designerId}
              onChange={(e) => setDesignerId(e.target.value)}
              required
            >
              <option value="">Select designer</option>
              {designers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={loadTemplate}>
                Load standard template
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={addTask}>
                Add task
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {tasks.map((task, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <input
                    className="input"
                    placeholder="Task description"
                    value={task.title}
                    onChange={(e) => updateTask(index, "title", e.target.value)}
                    required={index === 0}
                  />
                  <input
                    className="input"
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => updateTask(index, "dueDate", e.target.value)}
                    required={!!task.title.trim()}
                  />
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeTask(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {task.subTasks.length > 0 && (
                  <div className="space-y-1 pl-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Sub-tasks
                    </p>
                    {task.subTasks.map((subTask, subIndex) => (
                      <div key={subIndex} className="flex items-center gap-2">
                        <input
                          className="input text-sm"
                          value={subTask}
                          onChange={(e) =>
                            setTasks((current) =>
                              current.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      subTasks: row.subTasks.map((item, j) =>
                                        j === subIndex ? e.target.value : item
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                        />
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() =>
                            setTasks((current) =>
                              current.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      subTasks: row.subTasks.filter((_, j) => j !== subIndex),
                                    }
                                  : row
                              )
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() =>
                    setTasks((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, subTasks: [...row.subTasks, ""] } : row
                      )
                    )
                  }
                >
                  Add sub-task
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Creating..." : "Create Pathway"}
          </button>
          <Link href="/admin/pathways" className="btn-secondary">
            Cancel
          </Link>
        </div>

        {staff.length === 0 && (
          <p className="text-sm text-amber-700">
            Add staff users in Settings before creating a pathway.
          </p>
        )}
      </form>
    </div>
  );
}
