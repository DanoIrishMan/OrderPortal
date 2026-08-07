"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { getPathwayTaskAssigneeName, pathwayTaskStatus } from "@/lib/pathways";

interface PathwaySubTask {
  id: string;
  title: string;
  completedAt: string | null;
  completedBy: { name: string } | null;
}

interface PathwayStaff {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface PathwayTask {
  id: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
  completedBy: { name: string } | null;
  assignAccountManager: boolean;
  assignDesigner: boolean;
  subTasks: PathwaySubTask[];
  pathway: {
    id: string;
    name: string;
    client: ClientOption;
    accountManager: PathwayStaff;
    designer: PathwayStaff;
  };
}

function statusBadge(status: ReturnType<typeof pathwayTaskStatus>) {
  if (status === "complete") return "bg-green-100 text-green-800";
  if (status === "overdue") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export default function StaffPathwaysPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const staffRole = session?.user?.staffRole ?? "";
  const [tasks, setTasks] = useState<PathwayTask[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPathways = useCallback(async () => {
    const isAccountManager = staffRole === "ACCOUNT_MANAGER";
    const [pathwaysRes, clientsRes] = await Promise.all([
      fetch("/api/pathways"),
      isAccountManager ? fetch("/api/staff/clients") : Promise.resolve(null),
    ]);

    const pathways = await pathwaysRes.json();
    const flat: PathwayTask[] = [];

    for (const pathway of pathways) {
      for (const task of pathway.tasks) {
        flat.push({
          ...task,
          subTasks: task.subTasks ?? [],
          pathway: {
            id: pathway.id,
            name: pathway.name,
            client: pathway.client,
            accountManager: pathway.accountManager,
            designer: pathway.designer,
          },
        });
      }
    }

    flat.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setTasks(flat);

    const clientMap = new Map<string, ClientOption>();

    if (clientsRes) {
      const data = await clientsRes.json();
      for (const client of data.clients ?? []) {
        clientMap.set(client.id, { id: client.id, name: client.name });
      }
    }

    for (const task of flat) {
      clientMap.set(task.pathway.client.id, task.pathway.client);
    }

    const sortedClients = [...clientMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    setClients(sortedClients);
    setSelectedClientId((current) => {
      if (current && sortedClients.some((client) => client.id === current)) {
        return current;
      }
      return sortedClients[0]?.id ?? "";
    });
  }, [staffRole]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);

    loadPathways()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, staffRole, loadPathways]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => task.pathway.client.id === selectedClientId),
    [tasks, selectedClientId]
  );

  const selectedClient = clients.find((client) => client.id === selectedClientId);

  async function toggleComplete(task: PathwayTask, completed: boolean) {
    setUpdatingId(task.id);
    const res = await fetch(`/api/pathways/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (res.ok) {
      await loadPathways();
    }
    setUpdatingId(null);
  }

  async function toggleSubTask(subTask: PathwaySubTask, completed: boolean) {
    setUpdatingId(subTask.id);
    const res = await fetch(`/api/pathways/subtasks/${subTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (res.ok) {
      await loadPathways();
    }
    setUpdatingId(null);
  }

  return (
    <div>
      <PageHeader
        title="My Critical Pathway Tasks"
        description="Choose a client to view and complete their pathway tasks"
      />

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : clients.length === 0 ? (
        <div className="card text-sm text-slate-600">No clients assigned yet.</div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Clients</h2>
            <div className="flex flex-wrap gap-2">
              {clients.map((client) => {
                const taskCount = tasks.filter(
                  (task) => task.pathway.client.id === client.id
                ).length;
                const active = client.id === selectedClientId;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-medium">{client.name}</p>
                    <p
                      className={`mt-1 text-xs ${
                        active ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {taskCount} task{taskCount === 1 ? "" : "s"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {!selectedClient ? (
            <div className="card text-sm text-slate-600">Select a client to view tasks.</div>
          ) : filteredTasks.length === 0 ? (
            <div className="card text-sm text-slate-600">
              No pathway tasks for {selectedClient.name} yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Complete</th>
                    <th>Pathway</th>
                    <th>Task</th>
                    <th>Assign To</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.flatMap((task) => {
                    const status = pathwayTaskStatus(task);
                    const assignee = getPathwayTaskAssigneeName(task, task.pathway);
                    const rows = [
                      <tr key={task.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!task.completedAt}
                            disabled={updatingId === task.id}
                            onChange={(e) => toggleComplete(task, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td>{task.pathway.name}</td>
                        <td>{task.title}</td>
                        <td>{assignee}</td>
                        <td>{formatDate(new Date(task.dueDate))}</td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(status)}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>,
                    ];

                    for (const subTask of task.subTasks) {
                      rows.push(
                        <tr key={subTask.id} className="bg-slate-50/70">
                          <td className="pl-8">
                            <input
                              type="checkbox"
                              checked={!!subTask.completedAt}
                              disabled={updatingId === subTask.id}
                              onChange={(e) => toggleSubTask(subTask, e.target.checked)}
                              className="rounded"
                            />
                          </td>
                          <td />
                          <td className="text-sm text-slate-700">
                            <span className="mr-2 text-slate-400">↳</span>
                            {subTask.title}
                          </td>
                          <td className="text-sm text-slate-600">{assignee}</td>
                          <td />
                          <td>
                            {subTask.completedAt ? (
                              <span className="text-xs text-slate-500">
                                {subTask.completedBy?.name ?? "Done"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
