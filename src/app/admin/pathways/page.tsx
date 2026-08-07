"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import { pathwayTaskStatus } from "@/lib/pathways";

interface PathwayTask {
  id: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
}

interface Pathway {
  id: string;
  name: string;
  client: { id: string; name: string };
  accountManager: { name: string };
  designer: { name: string };
  tasks: PathwayTask[];
}

function pathwaySummary(tasks: PathwayTask[]) {
  const complete = tasks.filter((t) => t.completedAt).length;
  const overdue = tasks.filter((t) => pathwayTaskStatus(t) === "overdue").length;
  return { complete, overdue, total: tasks.length };
}

export default function AdminPathwaysPage() {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pathways")
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load pathways");
        }
        return r.json();
      })
      .then(setPathways)
      .catch((err: Error) => setError(err.message || "Failed to load pathways"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(pathway: Pathway) {
    if (
      !confirm(
        `Remove the "${pathway.name}" pathway for ${pathway.client.name}? This cannot be undone.`
      )
    ) {
      return;
    }

    setRemovingId(pathway.id);
    setError("");

    const res = await fetch(`/api/pathways/${pathway.id}`, { method: "DELETE" });
    setRemovingId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove pathway");
      return;
    }

    setPathways((current) => current.filter((item) => item.id !== pathway.id));
  }

  return (
    <div>
      <PageHeader
        title="Critical Pathways"
        description="Manage milestone tasks for each client"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/pathways/import" className="btn-secondary">
              Import CSV
            </Link>
            <Link href="/admin/pathways/new" className="btn-primary">
              New Pathway
            </Link>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : pathways.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No pathways yet.{" "}
          <Link href="/admin/pathways/new" className="font-medium text-slate-900 hover:underline">
            Create one
          </Link>
          .
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Pathway</th>
                <th>Account Manager</th>
                <th>Designer</th>
                <th>Progress</th>
                <th>Overdue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pathways.map((pathway) => {
                const summary = pathwaySummary(pathway.tasks);
                return (
                  <tr key={pathway.id}>
                    <td className="font-medium">{pathway.client.name}</td>
                    <td>{pathway.name}</td>
                    <td>{pathway.accountManager.name}</td>
                    <td>{pathway.designer.name}</td>
                    <td>
                      {summary.complete}/{summary.total} complete
                    </td>
                    <td>
                      {summary.overdue > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          {summary.overdue}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/pathways/${pathway.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemove(pathway)}
                          disabled={removingId === pathway.id}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        >
                          {removingId === pathway.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
