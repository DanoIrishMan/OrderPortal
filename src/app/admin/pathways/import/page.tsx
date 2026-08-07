"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PathwayCsvGroupPreview } from "@/types/pathways";

interface PreviewResponse {
  mode: "preview";
  headers: string[];
  totalRows: number;
  groups: PathwayCsvGroupPreview[];
  errors: Array<{ row: number; message: string }>;
  wouldCreate: number;
  wouldSkip: number;
}

interface ImportResponse {
  mode: "import";
  created: number;
  skipped: number;
  errors: string[];
  pathwayIds: string[];
}

type Step = "upload" | "preview" | "done";

export default function PathwayImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [notifyAssignees, setNotifyAssignees] = useState(true);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("commit", "false");

    const res = await fetch("/api/pathways/import", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to parse CSV");
      return;
    }

    setPreview(data);
    setStep("preview");
  }

  async function handleCommit() {
    if (!file) return;

    setCommitting(true);
    setError("");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("commit", "true");
    formData.set("notifyAssignees", String(notifyAssignees));

    const res = await fetch("/api/pathways/import", { method: "POST", body: formData });
    const data = await res.json();
    setCommitting(false);

    if (!res.ok) {
      setError(data.error || "Import failed");
      if (data.preview) setPreview(data.preview);
      return;
    }

    setResult(data);
    setStep("done");
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  return (
    <div>
      <PageHeader
        title="Import Critical Pathways CSV"
        description="Upload tasks for multiple clients in one file"
        action={
          <Link href="/admin/pathways" className="btn-secondary">
            Back to Pathways
          </Link>
        }
      />

      <div className="mb-6 card max-w-2xl text-sm text-slate-600">
        <p className="mb-2 font-medium text-slate-900">CSV columns</p>
        <p>
          <strong>Client</strong>, <strong>Account Manager</strong>, <strong>Designer</strong>,{" "}
          <strong>Pathway</strong> (optional), <strong>Task</strong>, <strong>Deadline</strong>
        </p>
        <p className="mt-2">
          Rows with the same client, account manager, designer, and pathway name are grouped into
          one pathway. Client and staff names must match existing records exactly.
        </p>
        <a
          href="/samples/critical-pathway-template.csv"
          download
          className="mt-3 inline-block text-sm font-medium text-slate-900 hover:underline"
        >
          Download sample CSV (Bohemians FC template)
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === "upload" && (
        <form onSubmit={handleUpload} className="card max-w-2xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CSV File</label>
            <input
              type="file"
              accept=".csv"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !file}>
            {loading ? "Reading CSV..." : "Upload & Preview"}
          </button>
        </form>
      )}

      {step === "preview" && preview && (
        <div className="space-y-6">
          <div className="card">
            <p className="mb-4 text-sm text-slate-600">
              {preview.totalRows} rows · {preview.wouldCreate} pathway
              {preview.wouldCreate === 1 ? "" : "s"} to create · {preview.wouldSkip} skipped
            </p>

            {preview.errors.length > 0 && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                <p className="font-medium">Fix these before importing:</p>
                <ul className="mt-2 list-disc pl-5">
                  {preview.errors.map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {preview.groups.map((group) => (
                <div key={group.key} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{group.clientName}</p>
                  <p className="text-sm text-slate-600">
                    {group.pathwayName} · AM: {group.accountManagerName} · Designer:{" "}
                    {group.designerName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{group.tasks.length} tasks</p>
                  {!group.clientId || !group.accountManagerId || !group.designerId ? (
                    <p className="mt-2 text-xs text-red-600">Cannot import — unresolved names</p>
                  ) : null}
                </div>
              ))}
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={notifyAssignees}
                onChange={(e) => setNotifyAssignees(e.target.checked)}
                className="rounded"
              />
              Email account manager and designer when pathways are created
            </label>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommit}
                disabled={committing || preview.errors.length > 0 || preview.wouldCreate === 0}
              >
                {committing ? "Importing..." : "Import Pathways"}
              </button>
              <button type="button" className="btn-secondary" onClick={reset}>
                Upload Different File
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="card max-w-2xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Import Complete</h2>
          <p className="text-sm text-slate-600">
            Created {result.created} pathway{result.created === 1 ? "" : "s"}
            {result.skipped > 0 ? ` · ${result.skipped} skipped` : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-red-700">
              {result.errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <Link href="/admin/pathways" className="btn-primary">
              View Pathways
            </Link>
            <button type="button" className="btn-secondary" onClick={reset}>
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
