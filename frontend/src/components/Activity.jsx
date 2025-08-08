import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Users, Target, Trophy, RefreshCcw, AlertTriangle } from "lucide-react";

const API = "https://surfari.onrender.com";
const REFRESH_MS = 30_000;
const QUOTA_MIN = 30; // should match backend summary.quotaTarget

export default function Activity() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [leaders, setLeaders] = useState([]); // weekly minutes per user
  const [names, setNames] = useState({});     // { userId: {username, displayName} }
  const [thumbs, setThumbs] = useState({});   // { userId: imageUrl }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const timer = useRef(null);

  // user ids we need profile/avatars for
  const allIds = useMemo(() => {
    const ids = new Set();
    leaders.forEach(l => ids.add(l.userId));
    recent.forEach(r => ids.add(r.userId));
    return Array.from(ids).filter(Boolean);
  }, [leaders, recent]);

  // ---------- utils ----------
  const safeJson = async (res) => {
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const body = ct.includes("application/json") ? await res.json() : await res.text();
      throw new Error(body?.error || body || `HTTP ${res.status}`);
    }
    return ct.includes("application/json") ? res.json() : {};
  };

  const fetchWithTimeout = (url, opts = {}, ms = 10_000) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
  };

  // Next reset = upcoming Monday 00:00 (local time)
  const nextWeeklyReset = () => {
    const now = new Date();
    const next = new Date(now);
    // getDay(): Sun=0 ... Sat=6  -> next Monday is (8 - day) % 7 days ahead
    const daysAhead = (8 - now.getDay()) % 7 || 7; // never "today"; always upcoming Monday
    next.setDate(now.getDate() + daysAhead);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const formatCountdown = (toDate) => {
    const diff = Math.max(0, toDate.getTime() - Date.now());
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  // ---------- data load ----------
  const load = async () => {
    try {
      setErr("");
      setLoading(true);

      const [s, r, l] = await Promise.all([
        fetchWithTimeout(`${API}/stats/summary`).then(safeJson),
        fetchWithTimeout(`${API}/stats/recent`).then(safeJson),
        fetchWithTimeout(`${API}/stats/leaderboard`).then(safeJson),
      ]);
      setSummary(s);
      setRecent(Array.isArray(r) ? r : []);
      setLeaders(Array.isArray(l) ? l : []);

      const ids = new Set();
      (l || []).forEach(x => x?.userId && ids.add(x.userId));
      (r || []).forEach(x => x?.userId && ids.add(x.userId));
      const idList = Array.from(ids);

      if (idList.length) {
        const [u, t] = await Promise.all([
          fetchWithTimeout(`${API}/roblox/users?ids=${idList.join(",")}`).then(safeJson),
          fetchWithTimeout(`${API}/roblox/thumbs?ids=${idList.join(",")}`).then(safeJson),
        ]);

        const nameMap = {};
        (u || []).forEach(x => { nameMap[x.id] = { username: x.name, displayName: x.displayName || x.name }; });
        setNames(nameMap);

        const thumbMap = {};
        (t?.data || []).forEach(d => { if (d?.targetId) thumbMap[d.targetId] = d.imageUrl || ""; });
        setThumbs(thumbMap);
      } else {
        setNames({});
        setThumbs({});
      }
    } catch (e) {
      console.error("[Activity] load error:", e);
      setErr(e.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer.current);
  }, []);

  // ---------- UI ----------
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Activity</h2>
          <p className="text-sm text-gray-500">Live usage, quotas, and recent sessions</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-50 transition"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Error banner */}
      {err && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            <div className="font-medium">Couldn’t load activity</div>
            <div className="text-red-600/80">{err}</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={Users} label="Players Online" value={summary?.liveCount ?? 0} />
        <Kpi icon={Clock} label="Minutes Today" value={summary?.todayMinutes ?? 0} />
        <Kpi icon={Target} label={`Quota Met (${summary?.quotaTarget ?? QUOTA_MIN}m)`} value={`${summary?.quotaPct ?? 0}%`} />
      </div>

      {/* NEW: Quota Progress panel */}
      <QuotaPanel
        leaders={leaders}           // [{userId, minutes}]
        names={names}               // id -> {username, displayName}
        thumbs={thumbs}             // id -> url
        quotaTarget={summary?.quotaTarget ?? QUOTA_MIN}
        nextResetAt={nextWeeklyReset()}
      />

      {loading ? (
        <SkeletonGrids />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <section className="rounded-2xl border border-orange-100 bg-white/95 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Top This Week</h3>
            </div>
            {leaders.length === 0 ? (
              <Empty msg="No leaderboard data yet." />
            ) : (
              <ul className="divide-y divide-orange-100">
                {leaders.map((u, i) => {
                  const n = names[u.userId] || {};
                  const img = thumbs[u.userId];
                  return (
                    <li key={u.userId} className="py-3 flex items-center gap-3">
                      <RankBadge n={i + 1} />
                      {img ? (
                        <img
                          src={img}
                          alt={n.username || u.userId}
                          className="h-9 w-9 rounded-lg border border-orange-100 object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <AvatarFallback name={n.displayName || n.username || String(u.userId)} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {n.displayName || n.username || `User ${u.userId}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          @{n.username || u.userId}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{Math.round(u.minutes)}m</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent */}
          <section className="rounded-2xl border border-orange-100 bg-white/95 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Sessions</h3>
            </div>
            {recent.length === 0 ? (
              <Empty msg="No recent sessions yet." />
            ) : (
              <ul className="divide-y divide-orange-100">
                {recent.map((s, i) => {
                  const n = names[s.userId] || {};
                  const img = thumbs[s.userId];
                  return (
                    <li key={i} className="py-3 flex items-center gap-3">
                      {img ? (
                        <img
                          src={img}
                          alt={n.username || s.userId}
                          className="h-9 w-9 rounded-lg border border-orange-100 object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <AvatarFallback name={n.displayName || n.username || String(s.userId)} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-gray-800 truncate">
                          <span className="font-medium text-gray-900">{n.displayName || n.username || `User ${s.userId}`}</span>
                          <span className="text-gray-500"> · {Math.round(s.minutes)}m</span>
                        </div>
                        <div className="text-xs text-gray-500">{timeAgo(s.endedAt || s.lastHeartbeat || s.startedAt)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* --- Quota panel --- */
function QuotaPanel({ leaders, names, thumbs, quotaTarget, nextResetAt }) {
  // Take top 8 by minutes for a tidy grid
  const rows = (leaders || []).slice(0, 8);

  const resetIn = formatCountdown(nextResetAt);

  return (
    <section className="rounded-2xl border border-orange-100 bg-white/95 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quota Progress</h3>
          <p className="text-sm text-gray-500">
            Target: <span className="font-medium text-gray-800">{quotaTarget} minutes</span> · Resets in{" "}
            <span className="font-medium text-gray-800">{resetIn}</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty msg="No quota progress yet this week." />
      ) : (
        <ul className="space-y-3">
          {rows.map((u) => {
            const n = names[u.userId] || {};
            const img = thumbs[u.userId];
            const mins = Math.round(u.minutes || 0);
            const pct = Math.min(100, Math.round((mins / quotaTarget) * 100));

            return (
              <li key={u.userId} className="flex items-center gap-3">
                {img ? (
                  <img
                    src={img}
                    alt={n.username || u.userId}
                    className="h-8 w-8 rounded-lg border border-orange-100 object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <AvatarFallback name={n.displayName || n.username || String(u.userId)} />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {n.displayName || n.username || `User ${u.userId}`}
                      </div>
                      <div className="text-xs text-gray-500 truncate">@{n.username || u.userId}</div>
                    </div>
                    <div className="text-xs text-gray-600 w-20 text-right">{mins}m</div>
                  </div>

                  {/* progress bar */}
                  <div className="mt-2 h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-orange-400"}`}
                      style={{ width: `${pct}%` }}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    />
                  </div>
                </div>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    pct >= 100
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {pct >= 100 ? "Met" : `${pct}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* UI bits */

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white/95 p-5 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function RankBadge({ n }) {
  const styles =
    n === 1 ? "bg-yellow-100 text-yellow-800"
    : n === 2 ? "bg-gray-100 text-gray-700"
    : n === 3 ? "bg-orange-100 text-orange-800"
    : "bg-slate-100 text-slate-700";
  return <span className={`w-7 h-7 grid place-items-center rounded-lg text-xs font-semibold ${styles}`}>{n}</span>;
}

function AvatarFallback({ name = "?" }) {
  return (
    <div className="h-9 w-9 rounded-lg grid place-items-center border border-orange-100 bg-gradient-to-br from-orange-100 to-emerald-100 text-orange-900 text-xs font-semibold">
      {String(name).slice(0, 1).toUpperCase()}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white/70 p-6 text-center text-sm text-gray-600">
      {msg}
    </div>
  );
}

function SkeletonGrids() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-64 rounded-2xl border border-orange-100 bg-white/70 animate-pulse" />
      <div className="h-64 rounded-2xl border border-orange-100 bg-white/70 animate-pulse" />
    </div>
  );
}

function timeAgo(dateLike) {
  try {
    const d = new Date(dateLike);
    const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}
