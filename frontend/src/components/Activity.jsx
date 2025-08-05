import React, { useMemo, useState } from "react";
import { Calendar, Search, Filter, Download, ArrowUpRight, Clock } from "lucide-react";

/** Mock dataset — swap with API later */
const RAW_LOGS = [
  { id: 1, user: "Kai", role: "Staff", minutes: 72, sessions: 3, last: "12m ago" },
  { id: 2, user: "Jason", role: "Staff", minutes: 64, sessions: 2, last: "27m ago" },
  { id: 3, user: "WaveMaster", role: "Coach", minutes: 54, sessions: 2, last: "1h ago" },
  { id: 4, user: "Luna", role: "Coach", minutes: 48, sessions: 2, last: "2h ago" },
  { id: 5, user: "Nori", role: "Staff", minutes: 29, sessions: 1, last: "3h ago" },
  { id: 6, user: "Milo", role: "Staff", minutes: 18, sessions: 1, last: "5h ago" },
];

const QUOTA_MIN = 30;

export default function ActivityPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All");
  const [status, setStatus] = useState("All"); // All | Met | Not Met
  const [week, setWeek] = useState("This week");

  // Derived
  const filtered = useMemo(() => {
    return RAW_LOGS.filter((r) => {
      const matchQuery = r.user.toLowerCase().includes(query.toLowerCase());
      const matchRole = role === "All" || r.role === role;
      const met = r.minutes >= QUOTA_MIN;
      const matchStatus =
        status === "All" || (status === "Met" ? met : !met);
      return matchQuery && matchRole && matchStatus;
    });
  }, [query, role, status]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const met = filtered.filter((r) => r.minutes >= QUOTA_MIN).length;
    const avg = total ? Math.round(filtered.reduce((s, r) => s + r.minutes, 0) / total) : 0;
    const top = filtered.slice().sort((a, b) => b.minutes - a.minutes)[0];
    return { total, metPct: total ? Math.round((met / total) * 100) : 0, avg, topUser: top?.user ?? "—", topMin: top?.minutes ?? 0 };
  }, [filtered]);

  const exportCSV = () => {
    const headers = ["User,Role,Minutes,Sessions,LastSeen"];
    const rows = filtered.map((r) => `${r.user},${r.role},${r.minutes},${r.sessions},${r.last}`);
    const blob = new Blob([headers.concat(rows).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header / Controls */}
      <section className="rounded-2xl border border-orange-100 bg-white/90 backdrop-blur p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-orange-900">Activity</h1>
            <p className="text-sm text-gray-600">Weekly time tracking and 30-minute quota status.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Select value={week} onChange={setWeek} label={<Calendar className="w-4 h-4" />} options={["This week", "Last week"]} />
            <Select value={role} onChange={setRole} label={<Filter className="w-4 h-4" />} options={["All", "Staff", "Coach"]} />
            <Select value={status} onChange={setStatus} label={<Filter className="w-4 h-4" />} options={["All", "Met", "Not Met"]} />
            <SearchBox value={query} onChange={setQuery} />
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50"
              aria-label="Export CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KPI title="Members Tracked" value={stats.total} />
        <KPI title="Met Quota" value={`${stats.metPct}%`} hint="≥ 30m this week" tone="ok" />
        <KPI title="Average Minutes" value={`${stats.avg}m`} />
        <KPI title="Top Performer" value={`${stats.topUser}`} hint={`${stats.topMin}m`} />
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-orange-100 bg-white/95 backdrop-blur shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <strong>{filtered.length}</strong> result{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Met</div>
            <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /> Not Met</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-orange-50/70 text-gray-700">
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th align="right">Minutes</Th>
                <Th align="right">Sessions</Th>
                <Th>Progress</Th>
                <Th>Last Seen</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {filtered.map((r) => (
                <ActivityRow key={r.id} record={r} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function KPI({ title, value, hint, tone }) {
  const chip =
    tone === "ok" ? "bg-green-100 text-green-700" :
    tone === "warn" ? "bg-yellow-100 text-yellow-700" :
    tone === "bad" ? "bg-red-100 text-red-700" : "";

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 sm:p-5">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs ${chip}`}>{hint}</div>}
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th className={`px-5 py-2.5 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function ActivityRow({ record }) {
  const met = record.minutes >= QUOTA_MIN;
  const pct = Math.max(0, Math.min(100, Math.round((record.minutes / QUOTA_MIN) * 100)));
  return (
    <tr className="hover:bg-orange-50/40">
      <Td>{record.user}</Td>
      <Td>{record.role}</Td>
      <Td align="right">{record.minutes}m</Td>
      <Td align="right">{record.sessions}</Td>
      <Td>
        <Progress value={pct} met={met} />
      </Td>
      <Td>{record.last}</Td>
      <Td align="right">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${met ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
          {met ? "Met" : "Not Met"}
        </span>
      </Td>
    </tr>
  );
}

function Td({ children, align = "left" }) {
  return (
    <td className={`px-5 py-3 ${align === "right" ? "text-right" : "text-left"} text-gray-800`}>
      {children}
    </td>
  );
}

function Progress({ value, met }) {
  return (
    <div className="w-40 sm:w-56">
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${met ? "bg-emerald-400" : "bg-orange-300"}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500">{Math.min(100, value)}%</div>
    </div>
  );
}

function Select({ value, onChange, label, options }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-2.5 py-2 text-sm">
      {label}
      <select
        className="outline-none bg-transparent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-2.5 py-2 text-sm">
      <Search className="w-4 h-4 text-orange-600" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search user…"
        className="w-40 bg-transparent outline-none placeholder:text-gray-400"
      />
    </label>
  );
}
