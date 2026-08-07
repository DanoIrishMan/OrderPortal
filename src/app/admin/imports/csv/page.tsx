"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { OrderUploadTabs } from "@/components/OrderUploadTabs";
import {
  CustomerMappingValue,
  WeeklyCsvByClientStats,
  WeeklyCsvCustomerInfo,
} from "@/types/orders";

interface Client {
  id: string;
  name: string;
}

interface WeeklyPreview {
  mode: "weekly";
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  customers: WeeklyCsvCustomerInfo[];
  byClient: WeeklyCsvByClientStats[];
  unmappedCustomers: string[];
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
  clients: Client[];
}

interface WeeklyResult {
  mode: "weekly";
  batchId: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  unmappedCustomers: string[];
  clientsCreated: string[];
  aliasesCreated?: string[];
  byClient: WeeklyCsvByClientStats[];
}

type Step = "upload" | "mapping" | "results";

export default function CsvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<WeeklyPreview | null>(null);
  const [customerMappings, setCustomerMappings] = useState<
    Record<string, CustomerMappingValue>
  >({});
  const [result, setResult] = useState<WeeklyResult | null>(null);

  useEffect(() => {
    if (!preview) return;

    const initial: Record<string, CustomerMappingValue> = {};
    for (const customer of preview.customers) {
      if (customer.isSkipped) {
        initial[customer.csvCustomerName] = "skip";
      } else if (customer.mappedClientId) {
        initial[customer.csvCustomerName] = customer.mappedClientId;
      }
    }
    setCustomerMappings(initial);
  }, [preview]);

  async function fetchPreview(mappings?: Record<string, CustomerMappingValue>) {
    if (!file) return null;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("commit", "false");
    if (mappings && Object.keys(mappings).length > 0) {
      formData.set("customerMappings", JSON.stringify(mappings));
    }

    const res = await fetch("/api/imports/csv", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to parse CSV");
    }

    if (data.mode !== "weekly") {
      throw new Error("This page expects a Sales Rep Summary CSV (Order_No + Workflow_Status columns).");
    }

    return data as WeeklyPreview;
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await fetchPreview();
      if (!data) return;
      setPreview(data);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPreview() {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const data = await fetchPreview(customerMappings);
      if (data) setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh preview");
    } finally {
      setLoading(false);
    }
  }

  function updateCustomerMapping(csvCustomerName: string, value: CustomerMappingValue) {
    setCustomerMappings((prev) => ({ ...prev, [csvCustomerName]: value }));
  }

  const autoCreateCustomers =
    preview?.customers.filter((c) => {
      const mapping = customerMappings[c.csvCustomerName];
      return !mapping && !c.mappedClientId;
    }) ?? [];

  async function handleCommit() {
    if (!file) return;

    setCommitting(true);
    setError("");

    const formData = new FormData();
    formData.set("file", file);
    formData.set("commit", "true");
    formData.set("customerMappings", JSON.stringify(customerMappings));
    formData.set("saveAliases", "true");

    const res = await fetch("/api/imports/csv", { method: "POST", body: formData });
    const data = await res.json();
    setCommitting(false);

    if (!res.ok) {
      setError(data.error || "Failed to import CSV");
      return;
    }

    setResult(data);
    setStep("results");
  }

  function resetFlow() {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setCustomerMappings({});
    setFile(null);
    setError("");
  }

  return (
    <div>
      <PageHeader
        title="Order Upload"
        description="Upload your offshore factory Sales Rep Summary CSV. Orders are routed to club accounts and updated each week by order number."
      />

      <OrderUploadTabs />

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === "upload" && (
        <form onSubmit={handleUpload} className="card max-w-2xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CSV File</label>
            <p className="mb-2 text-xs text-slate-500">
              Upload the full weekly export (e.g. Sales_Rep_Summary_Daniel_Ennis.csv). All clubs in
              the file are imported in one step.
            </p>
            <input
              type="file"
              accept=".csv"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading || !file}>
            {loading ? "Reading CSV..." : "Upload & Review"}
          </button>
        </form>
      )}

      {step === "mapping" && preview && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Import Preview</h2>
            <p className="mb-4 text-sm text-slate-600">
              {preview.totalRows} rows · {preview.wouldCreate} new · {preview.wouldUpdate} updates
              · {preview.wouldSkip} skipped
            </p>

            {preview.byClient.length > 0 && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {preview.byClient.map((club) => (
                  <div key={club.clientId} className="rounded-lg bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{club.clientName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {club.wouldCreate} new · {club.wouldUpdate} updates
                    </p>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mb-3 text-sm font-semibold text-slate-900">Customer → Club Mapping</h3>
            <p className="mb-4 text-sm text-slate-600">
              Each CSV customer name maps to one portal club. Names that extend an existing club
              (e.g. &quot;Wigan Athletic Community Trust&quot; → Wigan Athletic) are linked
              automatically as aliases. Remaining unknown names are added as new clients unless you
              choose an existing club or Skip.
            </p>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CSV Customer</th>
                    <th>Rows</th>
                    <th>Portal Club</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.customers.map((customer) => {
                    const mapping = customerMappings[customer.csvCustomerName];
                    const willAutoCreate = !mapping && !customer.mappedClientId;

                    return (
                    <tr key={customer.csvCustomerName}>
                      <td className="font-medium">
                        {customer.csvCustomerName}
                        {customer.isAutoMatched && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-normal text-blue-800">
                            Auto-linked to {customer.matchedToName ?? customer.mappedClientName}
                          </span>
                        )}
                        {willAutoCreate && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-normal text-green-800">
                            New client
                          </span>
                        )}
                      </td>
                      <td>{customer.rowCount}</td>
                      <td>
                        <select
                          className="input"
                          value={customerMappings[customer.csvCustomerName] ?? ""}
                          onChange={(e) =>
                            updateCustomerMapping(
                              customer.csvCustomerName,
                              e.target.value as CustomerMappingValue
                            )
                          }
                        >
                          <option value="">Create new client automatically</option>
                          <option value="skip">Skip (do not import)</option>
                          {preview.clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {autoCreateCustomers.length > 0 && (
              <p className="mt-4 text-sm text-green-700">
                {autoCreateCustomers.length} new client
                {autoCreateCustomers.length === 1 ? "" : "s"} will be created on import:{" "}
                {autoCreateCustomers.map((c) => c.csvCustomerName).join(", ")}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={refreshPreview}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh Preview"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommit}
                disabled={committing}
              >
                {committing ? "Importing..." : "Import Orders"}
              </button>
              <button type="button" className="btn-secondary" onClick={resetFlow}>
                Upload Different File
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {preview.headers.slice(0, 8).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {preview.headers.slice(0, 8).map((h) => (
                      <td key={h}>{row[h] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.totalRows > preview.rows.length && (
              <p className="px-4 py-2 text-xs text-slate-500">
                Showing first {preview.rows.length} of {preview.totalRows} rows
              </p>
            )}
          </div>
        </div>
      )}

      {step === "results" && result && (
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Import Complete</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-2xl font-semibold text-green-800">{result.created}</p>
              <p className="text-sm text-green-700">Created</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-2xl font-semibold text-blue-800">{result.updated}</p>
              <p className="text-sm text-blue-700">Updated</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-semibold text-slate-800">{result.skipped}</p>
              <p className="text-sm text-slate-600">Skipped</p>
            </div>
          </div>

          {result.aliasesCreated && result.aliasesCreated.length > 0 && (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium">Customer aliases saved</p>
              <ul className="mt-2 list-disc pl-5">
                {result.aliasesCreated.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.clientsCreated?.length > 0 && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
              <p className="font-medium">New clients created</p>
              <ul className="mt-2 list-disc pl-5">
                {result.clientsCreated.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.byClient.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">By Club</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {result.byClient.map((club) => (
                  <li key={club.clientId}>
                    <span className="font-medium text-slate-900">{club.clientName}</span>:{" "}
                    {club.wouldCreate} created, {club.wouldUpdate} updated
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Errors</p>
              <ul className="mt-2 list-disc pl-5">
                {result.errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="btn-primary" onClick={resetFlow}>
            Import Another CSV
          </button>
        </div>
      )}
    </div>
  );
}
