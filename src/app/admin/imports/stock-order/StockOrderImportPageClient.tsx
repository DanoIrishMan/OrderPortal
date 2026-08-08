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

interface ReviewItem {
  batchId: string;
  filename: string;
  parsed: StockOrderParseResult;
  row: ParsedOrderRow;
  suggestedClientId: string | null;
  suggestedClientName: string | null;
  clientId: string | null;
  isDuplicate: boolean;
}

interface ReviewState {
  items: ReviewItem[];
  clients: Client[];
  warnings: string[];
  duplicateCount: number;
}

export default function StockOrderImportPageClient() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [files, setFiles] = useState<FileList | null>(null);
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
    if (!files?.length) return;

    setLoading(true);
    setCommitResult(null);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      if (clientId) formData.set("clientId", clientId);

      const res = await fetch("/api/imports/stock-order", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse Excel files");
        return;
      }

      setReview({
        items: data.items.map((item: ReviewItem) => ({
          ...item,
          clientId: item.clientId || item.suggestedClientId || clientId || null,
        })),
        clients: data.clients ?? clients,
        warnings: data.warnings ?? [],
        duplicateCount: data.duplicateCount ?? 0,
      });
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!review) return;

    const items = review.items.filter((item) => item.clientId && item.row.orderNumber?.trim());
    if (items.length === 0) {
      setError("Select a club for each order before saving.");
      return;
    }

    if (items.length < review.items.length) {
      setError("Some orders are missing a club or order number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/imports/stock-order/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            clientId: item.clientId,
            batchId: item.batchId,
            row: item.row,
          })),
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
      setFiles(null);
    } catch {
      setError("Failed to save import. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index: number, updates: Partial<ReviewItem>) {
    if (!review) return;
    const items = [...review.items];
    items[index] = { ...items[index], ...updates };
    if (updates.row) {
      items[index].row = updates.row;
    }
    setReview({ ...review, items });
  }

  function updateRow(index: number, field: keyof ParsedOrderRow, value: string) {
    if (!review) return;
    const items = [...review.items];
    items[index] = {
      ...items[index],
      row: { ...items[index].row, [field]: value },
    };
    setReview({ ...review, items });
  }

  function removeItem(index: number) {
    if (!review) return;
    setReview({
      ...review,
      items: review.items.filter((_, i) => i !== index),
    });
  }

  const displayClients = review?.clients.length ? review.clients : clients;

  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Upload OrderWise Core Stock Order Form Excel files for stock garments sent to embroidery or print."
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
              OrderWise Core Stock Order Form v17 (.xlsx). One portal order per spreadsheet — you
              can select multiple files at once.
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
              multiple
              className="input"
              onChange={(e) => setFiles(e.target.files)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !files?.length}>
            {loading ? "Parsing Excel..." : "Upload & Review"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          {review.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">Parser warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {review.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {review.items.length} order(s) extracted · {review.duplicateCount} existing order(s)
              found
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
                  <th>File</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Club</th>
                  <th>Section</th>
                  <th>Date wanted</th>
                  <th>Qty</th>
                  <th>Exists?</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {review.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No orders to import.
                    </td>
                  </tr>
                ) : (
                  review.items.map((item, index) => (
                    <tr key={item.batchId} className={item.isDuplicate ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                      <td className="max-w-[10rem] truncate text-xs" title={item.filename}>
                        {item.filename}
                      </td>
                      <td>
                        <input
                          className="input min-w-[6rem]"
                          value={item.row.orderNumber}
                          onChange={(e) => updateRow(index, "orderNumber", e.target.value)}
                        />
                      </td>
                      <td className="max-w-[10rem] truncate text-sm" title={item.parsed.customerName}>
                        {item.parsed.customerName || "—"}
                      </td>
                      <td>
                        <select
                          className="input min-w-[10rem]"
                          value={item.clientId ?? ""}
                          onChange={(e) =>
                            updateItem(index, { clientId: e.target.value || null })
                          }
                        >
                          <option value="">Select club</option>
                          {displayClients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {item.suggestedClientName && !item.clientId && (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            Suggested: {item.suggestedClientName}
                          </p>
                        )}
                      </td>
                      <td>
                        <input
                          className="input min-w-[6rem]"
                          value={item.row.section ?? ""}
                          onChange={(e) => updateRow(index, "section", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input min-w-[7rem]"
                          value={item.row.expectedDeliveryDate || ""}
                          onChange={(e) => updateRow(index, "expectedDeliveryDate", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input w-20"
                          value={item.row.quantity ?? ""}
                          onChange={(e) => updateRow(index, "quantity", e.target.value)}
                        />
                      </td>
                      <td>{item.isDuplicate ? "Yes" : "No"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm text-red-600 hover:underline dark:text-red-400"
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

          {review.items.map((item, index) => (
            <details key={`${item.batchId}-details`} className="card">
              <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                {item.row.orderNumber || item.filename} — {item.parsed.lineItems.length} product line(s)
              </summary>
              <div className="mt-4 space-y-4">
                {item.parsed.embroidery.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Embroidery / print</p>
                    <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {item.parsed.embroidery.map((line, i) => (
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
                      {item.parsed.lineItems.map((lineItem, i) => (
                        <tr key={i}>
                          <td>{lineItem.description}</td>
                          <td>{lineItem.colour || "—"}</td>
                          <td>
                            {lineItem.sizes
                              ? Object.entries(lineItem.sizes)
                                  .map(([size, qty]) => `${size}: ${qty}`)
                                  .join(", ")
                              : "—"}
                          </td>
                          <td>{lineItem.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ))}

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              className="btn-primary"
              disabled={loading || review.items.length === 0}
            >
              {loading ? "Saving..." : `Add ${review.items.length} Order(s)`}
            </button>
            <button
              onClick={() => {
                setReview(null);
                setFiles(null);
              }}
              className="btn-secondary"
            >
              Upload Different Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
