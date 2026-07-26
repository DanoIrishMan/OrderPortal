"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { AdminUsersForm } from "@/components/AdminUsersForm";

interface Client {
  id: string;
  name: string;
  contactEmail: string;
}

interface Schedule {
  id: string;
  clientId: string;
  dayOfWeek: number;
  hour: number;
  enabled: boolean;
  lastRunAt: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clientId, setClientId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(9);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    const res = await fetch("/api/settings/schedules");
    const data = await res.json();
    setClients(data.clients ?? []);
    setSchedules(data.schedules ?? []);
  }

  async function handleSaveSchedule() {
    if (!clientId) return;
    setSaving(true);
    setMessage("");

    await fetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, dayOfWeek, hour, enabled }),
    });

    setSaving(false);
    setMessage("Schedule saved");
    loadSchedules();
  }

  async function handleDryRun() {
    const res = await fetch("/api/cron/weekly-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: true }),
    });
    const data = await res.json();
    setDryRunResult(data.message);
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure scheduled weekly exports and system options"
      />

      <div className="mb-6 card max-w-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Change Password</h2>
        <ChangePasswordForm />
      </div>

      <div className="mb-6 card max-w-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Admin Users</h2>
        <p className="mb-4 text-sm text-slate-600">
          Add other administrators who can manage clients, imports, and orders.
        </p>
        <AdminUsersForm />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Scheduled Weekly Export</h2>
          <p className="text-sm text-slate-600">
            Automatically prepare weekly order reports for each client. Email delivery requires
            SMTP configuration in production.
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Client</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Day of week</label>
              <select
                className="input"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hour (24h)</label>
              <select
                className="input"
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            Enable scheduled export
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveSchedule}
              disabled={saving || !clientId}
            >
              {saving ? "Saving..." : "Save Schedule"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleDryRun}>
              Test Dry Run
            </button>
          </div>

          {message && <p className="text-sm text-green-700">{message}</p>}
          {dryRunResult && <p className="text-sm text-slate-600">{dryRunResult}</p>}
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Active Schedules</h2>
          {schedules.length === 0 ? (
            <p className="text-sm text-slate-500">No schedules configured yet</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schedules.map((schedule) => {
                const client = clients.find((c) => c.id === schedule.clientId);
                return (
                  <li key={schedule.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {client?.name ?? schedule.clientId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {DAYS[schedule.dayOfWeek]} at {String(schedule.hour).padStart(2, "0")}:00
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          schedule.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {schedule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
