"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { OrderUploadTabs } from "@/components/OrderUploadTabs";
import { ParsedOrderRow } from "@/types/orders";

interface Client {
  id: string;
  name: string;
}

type ReviewRow = ParsedOrderRow & { batchId?: string; sourceFile?: string };

export default function PdfImportPageClient() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<{
    rows: ReviewRow[];
    warnings: string[];
    batchIds: string[];
    duplicateCount: number;
  } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !files?.length) return;

    setLoading(true);
    setCommitResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("clientId", clientId);
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/imports/pdf", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse PDFs");
        return;
      }

      setReview(data);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!review || !clientId) return;
    setLoading(true);
    setError(null);

    try {
      const batchId = review.batchIds[0];
      const res = await fetch("/api/imports/pdf/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          batchId,
          rows: review.rows,
          skipDuplicates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save import");
        return;
      }

      setCommitResult(`Added ${data.created} order(s). Skipped ${data.skipped}.`);
      setReview(null);
    } catch {
      setError("Failed to save import. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(index: number, field: keyof ParsedOrderRow, value: string) {
    if (!review) return;
    const rows = [...review.rows];
    rows[index] = { ...rows[index], [field]: value };
    setReview({ ...review, rows });
  }

  function removeRow(index: number) {
    if (!review) return;
    const rows = review.rows.filter((_, i) => i !== index);
    setReview({ ...review, rows });
  }

  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Add in-house production orders by uploading a PDF from your jobs system. Select the club, review extracted fields, then add the order."
      />

      <OrderUploadTabs />

      {commitResult && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {commitResult}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!review ? (
        <form onSubmit={handleUpload} className="card max-w-2xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Club</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Select a club</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Order PDF
            </label>
            <p className="mb-2 text-xs text-slate-500">
              In-house orders are not included in the weekly production CSV. Upload the order PDF
              to extract details, then review before adding.
            </p>
            <input
              type="file"
              accept=".pdf"
              multiple
              className="input"
              onChange={(e) => setFiles(e.target.files)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Parsing PDF..." : "Upload & Review"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {review.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Parser warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {review.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {review.rows.length} row(s) extracted · {review.duplicateCount} existing order(s) found
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              Skip existing orders (do not update)
            </label>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Section</th>
                  <th>Date</th>
                  <th>PO</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th>Exists?</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {review.rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No fields extracted. Add the order manually below.
                    </td>
                  </tr>
                ) : (
                  review.rows.map((row, index) => (
                    <tr key={index} className={row.isDuplicate ? "bg-amber-50" : ""}>
                      <td>
                        <input
                          className="input"
                          value={row.orderNumber}
                          onChange={(e) => updateRow(index, "orderNumber", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          placeholder="e.g. Shop"
                          value={row.section ?? row.csvCustomerName ?? ""}
                          onChange={(e) => updateRow(index, "section", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={row.orderDate || ""}
                          onChange={(e) => updateRow(index, "orderDate", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={row.poNumber || ""}
                          onChange={(e) => updateRow(index, "poNumber", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={row.description || ""}
                          onChange={(e) => updateRow(index, "description", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input w-20"
                          value={row.quantity ?? ""}
                          onChange={(e) => updateRow(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input w-24"
                          value={row.totalPrice ?? ""}
                          onChange={(e) => updateRow(index, "totalPrice", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={row.expectedDeliveryDate || ""}
                          onChange={(e) => updateRow(index, "expectedDeliveryDate", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={row.status || ""}
                          onChange={(e) => updateRow(index, "status", e.target.value)}
                        />
                      </td>
                      <td>{row.isDuplicate ? "Yes" : "No"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCommit} className="btn-primary" disabled={loading || review.rows.length === 0}>
              {loading ? "Saving..." : "Add Order(s)"}
            </button>
            <button onClick={() => setReview(null)} className="btn-secondary">
              Upload Different PDF
            </button>
            <button
              onClick={() =>
                setReview({
                  ...review,
                  rows: [...review.rows, { orderNumber: "", status: "In Production" }],
                })
              }
              className="btn-secondary"
            >
              Add Row Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
