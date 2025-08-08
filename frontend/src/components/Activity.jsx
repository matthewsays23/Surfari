import React, { useEffect, useState } from "react";

export default function Activity() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [s, r, l] = await Promise.all([
        fetch("https://surfari.onrender.com/stats/summary").then(res => res.json()),
        fetch("https://surfari.onrender.com/stats/recent").then(res => res.json()),
        fetch("https://surfari.onrender.com/stats/leaderboard").then(res => res.json()),
      ]);
      setSummary(s);
      setRecent(r);
      setLeaders(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6">Loading activity…</div>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi label="Players Online" value={summary?.liveCount ?? 0} />
        <Kpi label="Minutes Today" value={summary?.todayMinutes ?? 0} />
        <Kpi label={`Quota Met (${summary?.quotaTarget}m)`} value={`${summary?.quotaPct ?? 0}%`} />
      </div>

      {/* Leaderboard */}
      <section className="rounded-2xl border border-orange-100 bg-white/90 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Top This Week</h3>
        <ul className="divide-y divide-orange-100">
          {leaders.map((u) => (
            <li key={u.userId} className="py-2 flex justify-between text-sm">
              <span>User {u.userId}</span>
              <span className="font-semibold">{Math.round(u.minutes)}m</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent */}
      <section className="rounded-2xl border border-orange-100 bg-white/90 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sessions</h3>
        <ul className="divide-y divide-orange-100">
          {recent.map((s, i) => (
            <li key={i} className="py-2 text-sm flex justify-between">
              <span>User {s.userId}</span>
              <span>{Math.round(s.minutes)}m</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white/90 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
