import React, { useEffect, useMemo, useState } from "react";
import { Clock, Users, Target, Trophy, RefreshCcw } from "lucide-react";

const API = "https://surfari.onrender.com";

export default function Activity() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [names, setNames] = useState({});   // { userId: {username, displayName} }
  const [thumbs, setThumbs] = useState({}); // { userId: imageUrl }
  const [loading, setLoading] = useState(true);

  const allIds = useMemo(() => {
    const ids = new Set();
    leaders.forEach(l => ids.add(l.userId));
    recent.forEach(r => ids.add(r.userId));
    return Array.from(ids).filter(Boolean);
  }, [leaders, recent]);

  const load = async () => {
    try {
      setLoading(true);
      const [s, r, l] = await Promise.all([
        fetch(`${API}/stats/summary`).then(r => r.json()),
        fetch(`${API}/stats/recent`).then(r => r.json()),
        fetch(`${API}/stats/leaderboard`).then(r => r.json()),
      ]);
      setSummary(s);
      setRecent(r);
      setLeaders(l);

      // after we know ids, fetch profiles + thumbs
      const ids = new Set();
      l.forEach(x => ids.add(x.userId));
      r.forEach(x => ids.add(x.userId));
      const idList = Array.from(ids).filter(Boolean);
      if (idList.length) {
        const [u, t] = await Promise.all([
          fetch(`${API}/roblox/users?ids=${idList.join(",")}`).then(r => r.json()),
          fetch(`${API}/roblox/thumbs?ids=${idList.join(",")}`).then(r => r.json()),
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-orange-100 bg-white/70 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl border border-orange-100 bg-white/70 animate-pulse" />
          <div className="h-64 rounded-2xl border border-orange-100 bg-white/70 animate-pulse" />
        </div>
      </div>
    );
  }

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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={Users} label="Players Online" value={summary?.liveCount ?? 0} />
        <Kpi icon={Clock} label="Minutes Today" value={summary?.todayMinutes ?? 0} />
        <Kpi icon={Target} label={`Quota Met (${summary?.quotaTarget ?? 30}m)`} value={`${summary?.quotaPct ?? 0}%`} />
      </div>

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
                      <img src={img} alt={n.username || u.userId} className="h-9 w-9 rounded-lg border border-orange-100 object-cover" />
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
                      <img src={img} alt={n.username || s.userId} className="h-9 w-9 rounded-lg border border-orange-100 object-cover" />
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
    </div>
  );
}

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
  const styles = n === 1
    ? "bg-yellow-100 text-yellow-800"
    : n === 2
    ? "bg-gray-100 text-gray-700"
    : n === 3
    ? "bg-orange-100 text-orange-800"
    : "bg-slate-100 text-slate-700";
  return (
    <span className={`w-7 h-7 grid place-items-center rounded-lg text-xs font-semibold ${styles}`}>{n}</span>
  );
}

function AvatarFallback({ name = "?" }) {
  return (
    <div className="h-9 w-9 rounded-lg grid place-items-center border border-orange-100 bg-gradient-to-br from-orange-100 to-emerald-100 text-orange-900 text-xs font-semibold">
      {String(name).slice(0, 1).toUpperCase()}
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
