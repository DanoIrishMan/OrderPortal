"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { OrderUploadTabs } from "@/components/OrderUploadTabs";
import { StockOrderParseResult } from "@/lib/stock-order-xlsx-parser";
import { ParsedOrderRow } from "@/types/orders";

interface Client {
  id: string;
  name: string;
}

interface ReviewState {
  batchId: string;
  filename: string;
  parsed: StockOrderParseResult;
  row: ParsedOrderRow;
  clients: Client[];
  suggestedClientId: string | null;
  suggestedClientName: string | null;
  isDuplicate: boolean;
  warnings: string[];
}

export default function StockOrderImportPageClient() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setCommitResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      if (clientId) formData.set("clientId", clientId);

      const res = await fetch("/api/imports/stock-order", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse Excel file");
        return;
      }

      setReview(data);
      if (data.clientId) setClientId(data.clientId);
      else if (data.suggestedClientId) setClientId(data.suggestedClientId);
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
      const res = await fetch("/api/imports/stock-order/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          batchId: review.batchId,
          row: review.row,
          skipDuplicates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save import");
        return;
      }

      if (data.skipped && !data.created) {
        setCommitResult("Order skipped (already exists).");
      } else {
        setCommitResult(`Added ${data.created} order(s). Skipped ${data.skipped}.`);
      }
      setReview(null);
      setFile(null);
    } catch {
      setError("Failed to save import. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(field: keyof ParsedOrderRow, value: string) {
    if (!review) return;
    setReview({ ...review, row: { ...review.row, [field]: value } });
  }

  const displayClients = review?.clients.length ? review.clients : clients;

  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Upload OrderWise Core Stock Order Form Excel files for stock garments sent to embroidery."
      />

      <OrderUploadTabs />

      {commitResult && (
        <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          {commitResult}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {!review ? (
        <form onSubmit={handleUpload} className="card max-w-2xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Club <span className="font-normal text-slate-500">(optional — auto-matched from customer name)</span>
            </label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Auto-match from spreadsheet</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Stock / Embroidery Excel
            </label>
            <p className="mb-2 text-xs text-slate-500">
              OrderWise Core Stock Order Form v17 (.xlsx). One portal order is created from the first
              worksheet tab.
            </p>
            <p className="mb-2 text-xs text-slate-500">
              <a
                href="/samples/Bohemians FC European Set A95937 04.08.26.xlsx"
                className="text-blue-600 hover:underline dark:text-blue-400"
                download
              >
                Download sample file
              </a>
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !file}>
            {loading ? "Parsing Excel..." : "Upload & Review"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {(review.warnings.length > 0 || review.parsed.warnings.length > 0) && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">Parser warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {[...review.warnings, ...review.parsed.warnings].map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{review.parsed.orderNumber || "No order number"}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {review.filename} · {review.parsed.customerName}
                </p>
                {review.suggestedClientName && !clientId && (
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Suggested club: {review.suggestedClientName}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                Skip if order already exists
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Club
              </label>
              <select
                className="input max-w-md"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">Select a club</option>
                {displayClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Date ordered</p>
                <input
                  className="input mt-1"
                  value={review.row.orderDate || ""}
                  onChange={(e) => updateRow("orderDate", e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Date wanted</p>
                <input
                  className="input mt-1"
                  value={review.row.expectedDeliveryDate || ""}
                  onChange={(e) => updateRow("expectedDeliveryDate", e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">PO number</p>
                <input
                  className="input mt-1"
                  value={review.row.poNumber || ""}
                  onChange={(e) => updateRow("poNumber", e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Total qty</p>
                <input
                  className="input mt-1"
                  value={review.row.quantity ?? ""}
                  onChange={(e) => updateRow("quantity", e.target.value)}
                />
              </div>
            </div>

            {review.parsed.embroidery.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Embroidery</p>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  {review.parsed.embroidery.map((line, i) => (
                    <li key={i}>
                      <span className="font-medium">{line.label}:</span> {line.description}
                      {line.code ? ` (${line.code})` : ""}
                      {line.position ? ` – ${line.position}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Colour</th>
                    <th>Sizes</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {review.parsed.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td>{item.colour || "—"}</td>
                      <td>
                        {item.sizes
                          ? Object.entries(item.sizes)
                              .map(([size, qty]) => `${size}: ${qty}`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Section: {review.row.section ?? "Embroidery"} ·{" "}
              {review.isDuplicate ? (
                <span className="text-amber-700 dark:text-amber-300">Order already exists for this club</span>
              ) : (
                "New order"
              )}
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCommit} className="btn-primary" disabled={loading || !clientId}>
              {loading ? "Saving..." : "Add Order"}
            </button>
            <button onClick={() => setReview(null)} className="btn-secondary">
              Upload Different File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
