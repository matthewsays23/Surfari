import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Users, Clock, UserPlus, UserMinus, RefreshCcw, Shield
} from "lucide-react";

const API = "https://surfari.onrender.com"; // backend base

export default function Sessions() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date())); // Monday 00:00
  const [sessions, setSessions] = useState([]); // [{ id, start, end, title, hostId, cohostId, serverTag }]
  const [names, setNames] = useState({});   // { userId: { username, displayName } }
  const [thumbs, setThumbs] = useState({}); // { userId: imageUrl }
  const [me, setMe] = useState(null);       // { userId, username, ... } from /auth/verify
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const refreshTimer = useRef(null);

  // Load my identity once
  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    fetch(`${API}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // Load sessions on mount + when week changes
  useEffect(() => {
    loadWeek();
    refreshTimer.current = setInterval(loadWeek, 30_000);
    return () => clearInterval(refreshTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function loadWeek() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ weekStart: weekStart.toISOString() });
      const data = await safeJson(fetch(`${API}/sessions?${qs}`));
      setSessions(Array.isArray(data) ? data : []);

      // hydrate user profiles seen in the schedule (host/cohost)
      const ids = new Set();
      data.forEach(s => { if (s.hostId) ids.add(s.hostId); if (s.cohostId) ids.add(s.cohostId); });
      if (ids.size) {
        const list = [...ids];
        const [u, t] = await Promise.all([
          safeJson(fetch(`${API}/roblox/users?ids=${list.join(",")}`)),
          safeJson(fetch(`${API}/roblox/thumbs?ids=${list.join(",")}`)),
        ]);

        const nm = {};
        (u || []).forEach(x => (nm[x.id] = { username: x.name, displayName: x.displayName || x.name }));
        setNames(nm);

        const tm = {};
        (t?.data || []).forEach(d => { if (d?.targetId) tm[d.targetId] = d.imageUrl || ""; });
        setThumbs(tm);
      } else {
        setNames({});
        setThumbs({});
      }
    } finally {
      setLoading(false);
    }
  }

  // Claim / unclaim
  async function claim(sessionId, role /* "host" | "cohost" */) {
    if (!me?.userId) return;
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      // optimistic update
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        const copy = { ...s };
        if (role === "host") copy.hostId = me.userId;
        if (role === "cohost") copy.cohostId = me.userId;
        return copy;
      }));
      await safeJson(fetch(`${API}/sessions/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, role })
      }));
    } catch (e) {
      console.error(e);
      // revert if failed
      loadWeek();
    } finally {
      setBusy(false);
    }
  }

  async function unclaim(sessionId, role) {
    if (!me?.userId) return;
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        const copy = { ...s };
        if (role === "host" && copy.hostId === me.userId) copy.hostId = null;
        if (role === "cohost" && copy.cohostId === me.userId) copy.cohostId = null;
        return copy;
      }));
      await safeJson(fetch(`${API}/sessions/unclaim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, role })
      }));
    } catch (e) {
      console.error(e);
      loadWeek();
    } finally {
      setBusy(false);
    }
  }

  // Group by day column
  const columns = useMemo(() => {
    const byDay = makeEmptyWeekColumns(weekStart);
    for (const s of sessions) {
      const d = new Date(s.start);
      const key = keyForDay(d);
      if (byDay[key]) byDay[key].push(s);
    }
    // sort each day by start time
    Object.values(byDay).forEach(arr => arr.sort((a, b) => new Date(a.start) - new Date(b.start)));
    return byDay;
  }, [sessions, weekStart]);

  // UI
  return (
    <div className="space-y-6">
      {/* Header / Week Picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Sessions</h2>
            <p className="text-sm text-gray-500">Claim host/co-host for this week</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 rounded-lg border border-orange-200 hover:bg-orange-50"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <WeekStrip weekStart={weekStart} />
          <button
            onClick={() => setWeekStart(addDays(weekStart, +7))}
            className="p-2 rounded-lg border border-orange-200 hover:bg-orange-50"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={loadWeek}
            className="ml-2 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-50"
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {Object.entries(columns).map(([key, list]) => {
          const dayDate = new Date(key);
          const isToday = sameDay(dayDate, new Date());
          return (
            <div key={key} className={`rounded-2xl border ${isToday ? "border-orange-300" : "border-orange-100"} bg-white/95 p-3`}>
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {dayDate.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? "text-orange-700" : "text-gray-900"}`}>
                  {dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-orange-100 bg-white/70 animate-pulse" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="text-sm text-gray-500 border border-dashed border-orange-200 rounded-xl p-3 text-center">
                  No sessions
                </div>
              ) : (
                <div className="space-y-3">
                  {list.map(s => (
                    <SessionCard
                      key={s.id}
                      s={s}
                      me={me}
                      names={names}
                      thumbs={thumbs}
                      busy={busy}
                      onClaim={claim}
                      onUnclaim={unclaim}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----- Card ----- */
function SessionCard({ s, me, names, thumbs, busy, onClaim, onUnclaim }) {
  const start = new Date(s.start);
  const end = new Date(s.end);
  const host = s.hostId ? (names[s.hostId] || {}) : null;
  const co   = s.cohostId ? (names[s.cohostId] || {}) : null;

  const hostMine = me?.userId && s.hostId === me.userId;
  const coMine   = me?.userId && s.cohostId === me.userId;

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50/40 to-emerald-50/30 p-3 shadow-sm">
      <div className="text-[11px] text-gray-500 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        {formatTimeRange(start, end)}
        {s.serverTag && <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"> {s.serverTag} </span>}
      </div>

      <div className="mt-1 text-sm font-semibold text-gray-900 truncate">
        {s.title || "Training Session"}
      </div>

      {/* Host / Co-host row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <RoleBox
          label="Host"
          userId={s.hostId}
          profile={host}
          avatar={s.hostId ? thumbs[s.hostId] : ""}
          mine={hostMine}
          onClaim={() => onClaim(s.id, "host")}
          onUnclaim={() => onUnclaim(s.id, "host")}
          busy={busy}
        />
        <RoleBox
          label="Co-Host"
          userId={s.cohostId}
          profile={co}
          avatar={s.cohostId ? thumbs[s.cohostId] : ""}
          mine={coMine}
          onClaim={() => onClaim(s.id, "cohost")}
          onUnclaim={() => onUnclaim(s.id, "cohost")}
          busy={busy}
        />
      </div>
    </div>
  );
}

function RoleBox({ label, userId, profile, avatar, mine, busy, onClaim, onUnclaim }) {
  return (
    <div className="rounded-lg border border-orange-100 bg-white/70 p-2">
      <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
        <Shield className="w-3.5 h-3.5 text-orange-500" />
        {label}
      </div>

      {userId ? (
        <div className="flex items-center gap-2">
          {avatar ? (
            <img src={avatar} alt={profile?.username || userId} className="h-7 w-7 rounded-md border border-orange-100 object-cover" />
          ) : (
            <div className="h-7 w-7 rounded-md grid place-items-center border border-orange-100 bg-orange-50 text-orange-700 text-[11px]">
              {(profile?.displayName || profile?.username || String(userId)).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">{profile?.displayName || profile?.username || `User ${userId}`}</div>
            <div className="text-[11px] text-gray-500 truncate">@{profile?.username || userId}</div>
          </div>

          {mine ? (
            <button
              disabled={busy}
              onClick={onUnclaim}
              className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
            >
              <UserMinus className="w-3.5 h-3.5" /> Unclaim
            </button>
          ) : (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">Taken</span>
          )}
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={onClaim}
          className="w-full inline-flex items-center justify-center gap-1 text-[12px] px-2 py-1.5 rounded-md border border-orange-200 hover:bg-orange-50"
        >
          <UserPlus className="w-3.5 h-3.5" /> Claim
        </button>
      )}
    </div>
  );
}

/* ----- Small UI helpers ----- */
function WeekStrip({ weekStart }) {
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const today = new Date();
  return (
    <div className="flex items-center gap-1">
      {days.map(d => {
        const isToday = sameDay(d, today);
        return (
          <div
            key={d.toISOString()}
            className={`w-9 h-9 grid place-items-center rounded-lg text-sm
            ${isToday ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}
            title={d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          >
            {d.getDate()}
          </div>
        );
      })}
    </div>
  );
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function makeEmptyWeekColumns(weekStart) {
  const obj = {};
  for (let i = 0; i < 7; i++) obj[keyForDay(addDays(weekStart, i))] = [];
  return obj;
}
function keyForDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function formatTimeRange(start, end) {
  const s = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const e = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dayWord = sameDay(start, new Date()) ? "Today" : start.toLocaleDateString(undefined, { weekday: "long" });
  return `${dayWord} · ${s} – ${e}`;
}
async function safeJson(promise) {
  const res = await promise;
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    throw new Error(body?.error || body || `HTTP ${res.status}`);
  }
  return ct.includes("application/json") ? res.json() : {};
}
