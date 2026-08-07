"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { pathwayTaskStatus } from "@/lib/pathways";
import { getSubTaskTemplateForTitle } from "@/lib/pathway-templates";

interface PathwaySubTask {
  id: string;
  title: string;
  completedAt: string | null;
  completedBy: { name: string } | null;
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
}

interface Pathway {
  id: string;
  name: string;
  client: { name: string };
  accountManager: { id: string; name: string };
  designer: { id: string; name: string };
  tasks: PathwayTask[];
}

function statusBadge(status: ReturnType<typeof pathwayTaskStatus>) {
  if (status === "complete") return "bg-green-100 text-green-800";
  if (status === "overdue") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function subTaskProgress(subTasks: PathwaySubTask[]) {
  if (subTasks.length === 0) return null;
  const complete = subTasks.filter((subTask) => subTask.completedAt).length;
  return `${complete}/${subTasks.length} sub-tasks`;
}

export default function PathwayDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newSubTaskTitles, setNewSubTaskTitles] = useState<Record<string, string>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busySubTaskId, setBusySubTaskId] = useState<string | null>(null);

  const loadPathway = useCallback(async () => {
    const res = await fetch(`/api/pathways/${id}`);
    const data = await res.json();
    setPathway(data);
  }, [id]);

  useEffect(() => {
    loadPathway().finally(() => setLoading(false));
  }, [loadPathway]);

  async function addSubTask(taskId: string, e?: FormEvent) {
    e?.preventDefault();
    const title = newSubTaskTitles[taskId]?.trim();
    if (!title) return;

    setBusyTaskId(taskId);
    setError("");

    const res = await fetch(`/api/pathways/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    setBusyTaskId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add sub-task");
      return;
    }

    setNewSubTaskTitles((current) => ({ ...current, [taskId]: "" }));
    await loadPathway();
  }

  async function addTemplateSubTasks(task: PathwayTask) {
    const template = getSubTaskTemplateForTitle(task.title);
    if (template.length === 0) return;

    const existing = new Set(task.subTasks.map((subTask) => subTask.title.trim().toLowerCase()));
    const titles = template.filter((title) => !existing.has(title.trim().toLowerCase()));
    if (titles.length === 0) return;

    setBusyTaskId(task.id);
    setError("");

    const res = await fetch(`/api/pathways/tasks/${task.id}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles }),
    });

    setBusyTaskId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add sub-tasks");
      return;
    }

    await loadPathway();
  }

  async function toggleSubTask(subTask: PathwaySubTask, completed: boolean) {
    setBusySubTaskId(subTask.id);
    setError("");

    const res = await fetch(`/api/pathways/subtasks/${subTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    setBusySubTaskId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update sub-task");
      return;
    }

    await loadPathway();
  }

  async function removeSubTask(subTaskId: string) {
    if (!confirm("Remove this sub-task?")) return;

    setBusySubTaskId(subTaskId);
    setError("");

    const res = await fetch(`/api/pathways/subtasks/${subTaskId}`, { method: "DELETE" });
    setBusySubTaskId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove sub-task");
      return;
    }

    await loadPathway();
  }

  async function updateTaskAssignees(
    task: PathwayTask,
    assignAccountManager: boolean,
    assignDesigner: boolean
  ) {
    if (!assignAccountManager && !assignDesigner) {
      setError("At least one assignee is required");
      return;
    }

    setBusyTaskId(task.id);
    setError("");

    const res = await fetch(`/api/pathways/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignAccountManager, assignDesigner }),
    });

    setBusyTaskId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update assignees");
      return;
    }

    await loadPathway();
  }

  if (loading) return <p className="text-slate-500">Loading...</p>;
  if (!pathway) return <p className="text-red-600">Pathway not found</p>;

  return (
    <div>
      <PageHeader
        title={pathway.name}
        description={`${pathway.client.name} · AM: ${pathway.accountManager.name} · Designer: ${pathway.designer.name}`}
        action={
          <Link href="/admin/pathways" className="btn-secondary">
            Back to list
          </Link>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {pathway.tasks.map((task) => {
          const status = pathwayTaskStatus(task);
          const progress = subTaskProgress(task.subTasks);
          const template = getSubTaskTemplateForTitle(task.title);
          const hasMissingTemplateItems = template.some(
            (title) =>
              !task.subTasks.some(
                (subTask) => subTask.title.trim().toLowerCase() === title.trim().toLowerCase()
              )
          );

          return (
            <div key={task.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{task.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Deadline: {formatDate(new Date(task.dueDate))}
                    {task.completedBy ? ` · Completed by ${task.completedBy.name}` : ""}
                    {progress ? ` · ${progress}` : ""}
                  </p>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-medium text-slate-700">Assign to:</p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={task.assignAccountManager}
                          disabled={busyTaskId === task.id}
                          onChange={(e) =>
                            updateTaskAssignees(
                              task,
                              e.target.checked,
                              task.assignDesigner
                            )
                          }
                          className="rounded"
                        />
                        {pathway.accountManager.name} (Account Manager)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={task.assignDesigner}
                          disabled={busyTaskId === task.id}
                          onChange={(e) =>
                            updateTaskAssignees(
                              task,
                              task.assignAccountManager,
                              e.target.checked
                            )
                          }
                          className="rounded"
                        />
                        {pathway.designer.name} (Designer)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {task.subTasks.length === 0 ? (
                  <p className="text-sm text-slate-500">No sub-tasks yet.</p>
                ) : (
                  task.subTasks.map((subTask) => (
                    <div
                      key={subTask.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <label className="flex flex-1 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={!!subTask.completedAt}
                          disabled={busySubTaskId === subTask.id}
                          onChange={(e) => toggleSubTask(subTask, e.target.checked)}
                          className="rounded"
                        />
                        <span className={subTask.completedAt ? "text-slate-500 line-through" : ""}>
                          {subTask.title}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        {subTask.completedBy && (
                          <span className="text-xs text-slate-500">{subTask.completedBy.name}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSubTask(subTask.id)}
                          disabled={busySubTaskId === subTask.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => addSubTask(task.id, e)}
                className="mt-4 flex flex-wrap items-center gap-2"
              >
                <input
                  className="input max-w-sm flex-1"
                  placeholder="New sub-task"
                  value={newSubTaskTitles[task.id] ?? ""}
                  onChange={(e) =>
                    setNewSubTaskTitles((current) => ({
                      ...current,
                      [task.id]: e.target.value,
                    }))
                  }
                />
                <button
                  type="submit"
                  className="btn-secondary text-sm"
                  disabled={busyTaskId === task.id || !newSubTaskTitles[task.id]?.trim()}
                >
                  Add sub-task
                </button>
                {template.length > 0 && hasMissingTemplateItems && (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={busyTaskId === task.id}
                    onClick={() => addTemplateSubTasks(task)}
                  >
                    Add sample sub-tasks
                  </button>
                )}
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
