"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

interface Client {
  id: string;
  name: string;
}

export default function ExportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [updatedSince, setUpdatedSince] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [includeChanges, setIncludeChanges] = useState(true);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  function buildExportUrl() {
    const params = new URLSearchParams();
    params.set("clientId", clientId);
    params.set("format", format);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (updatedSince) params.set("updatedSince", updatedSince);
    if (openOnly) params.set("openOnly", "true");
    if (includeChanges && updatedSince) params.set("includeChanges", "true");
    return `/api/exports?${params}`;
  }

  function setLastWeek() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    setUpdatedSince(weekAgo.toISOString().slice(0, 10));
    setIncludeChanges(true);
  }

  return (
    <div>
      <PageHeader
        title="Export Reports"
        description="Generate weekly Excel or CSV reports for your pro club clients"
      />

      <div className="card max-w-2xl space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
          <select
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={format === "xlsx"}
                onChange={() => setFormat("xlsx")}
              />
              Excel (.xlsx)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
              />
              CSV
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Order date from</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Order date to</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Updated since (for weekly reports)
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              className="input"
              value={updatedSince}
              onChange={(e) => setUpdatedSince(e.target.value)}
            />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={setLastWeek}>
              Last 7 days
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="rounded"
            />
            Open orders only (exclude delivered & cancelled)
          </label>
          {format === "xlsx" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includeChanges}
                onChange={(e) => setIncludeChanges(e.target.checked)}
                className="rounded"
              />
              Include &quot;Changes This Week&quot; sheet (requires updated since date)
            </label>
          )}
        </div>

        <a
          href={clientId ? buildExportUrl() : "#"}
          className={`btn-primary inline-flex ${!clientId ? "pointer-events-none opacity-50" : ""}`}
          download
        >
          Download Export
        </a>
      </div>
    </div>
  );
}
