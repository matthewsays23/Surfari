import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCcw,
  UserPlus, UserMinus, Clock, Shield
} from "lucide-react";

const API = "https://surfari.onrender.com"; // change if needed
const REFRESH_MS = 30_000;

// Fixed EST slots (24h clock hours)
const EST_SLOTS = [0, 3, 6, 9, 12, 15, 18, 21];

export default function Sessions() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date())); // Monday 00:00 local
  const [sessions, setSessions]     = useState([]); // from backend
  const [me, setMe]                 = useState(null); // /auth/verify
  const [names, setNames]           = useState({});   // { userId: {username,displayName} }
  const [thumbs, setThumbs]         = useState({});   // { userId: img }
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const refreshRef = useRef(null);

  // Load my identity once
  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) return;
    fetch(`${API}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // Load board when week changes
  useEffect(() => {
    loadBoard();
    clearInterval(refreshRef.current);
    refreshRef.current = setInterval(loadBoard, REFRESH_MS);
    return () => clearInterval(refreshRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function loadBoard() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ weekStart: weekStart.toISOString() });
      const data = await safeJson(fetch(`${API}/sessions?${qs}`));
      setSessions(Array.isArray(data) ? data : []);

      // hydrate any host/cohost ids
      const ids = new Set();
      data.forEach(s => { if (s.hostId) ids.add(s.hostId); if (s.cohostId) ids.add(s.cohostId); });
      if (ids.size) {
        const list = [...ids];
        const [u, t] = await Promise.all([
          safeJson(fetch(`${API}/roblox/users?ids=${list.join(",")}`)),
          safeJson(fetch(`${API}/roblox/thumbs?ids=${list.join(",")}`)),
        ]);
        const nm = {};
        (u || []).forEach(x => nm[x.id] = { username: x.name, displayName: x.displayName || x.name });
        setNames(nm);

        const tm = {};
        (t?.data || []).forEach(d => { if (d?.targetId) tm[d.targetId] = d.imageUrl || ""; });
        setThumbs(tm);
      } else {
        setNames({}); setThumbs({});
      }
    } finally {
      setLoading(false);
    }
  }

  // Build the week grid (days × fixed EST slots)
  const grid = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const col = { day, slots: [] };
      for (const hour of EST_SLOTS) {
        const { startUTC, endUTC, label } = estSlotForDay(day, hour);
        const match = sessions.find(s => sameMinute(new Date(s.start), startUTC));
        col.slots.push({ label, startUTC, endUTC, session: match || null });
      }
      out.push(col);
    }
    return out;
  }, [weekStart, sessions]);

  async function claim(sessionId, role) {
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      // optimistic
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        return { ...s, [role === "host" ? "hostId" : "cohostId"]: me?.userId || s[role] };
      }));
      await safeJson(fetch(`${API}/sessions/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, role })
      }));
    } catch (e) {
      console.error(e);
      loadBoard();
    } finally {
      setBusy(false);
    }
  }

  async function unclaim(sessionId, role) {
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      setSessions(prev => prev.map(s => {
        if (s.id !== sessionId) return s;
        const f = role === "host" ? "hostId" : "cohostId";
        if (me?.userId && s[f] === me.userId) return { ...s, [f]: null };
        return s;
      }));
      await safeJson(fetch(`${API}/sessions/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, role })
      }));
    } catch (e) {
      console.error(e);
      loadBoard();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sessions</h2>
          <p className="text-sm text-gray-500">Claim Host / Co-Host for this week (EST)</p>
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
            onClick={loadBoard}
            className="ml-2 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-50"
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {grid.map((col, i) => {
          const isToday = sameDay(col.day, new Date());
          return (
            <div key={i} className={`rounded-2xl border ${isToday ? "border-orange-300" : "border-orange-100"} bg-white/95 p-3`}>
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {col.day.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? "text-orange-700" : "text-gray-900"}`}>
                  {col.day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: EST_SLOTS.length }).map((_, k) => (
                    <div key={k} className="h-24 rounded-xl border border-orange-100 bg-white/70 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {col.slots.map((slot, k) => (
                    <SlotCard
                      key={k}
                      slot={slot}
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

/* ---------- Slot Card ---------- */
function SlotCard({ slot, me, names, thumbs, busy, onClaim, onUnclaim }) {
  const s = slot.session;
  const label = slot.label; // e.g., "12:00 AM EST"
  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50/40 to-emerald-50/30 p-3 shadow-sm">
      <div className="text-[11px] text-gray-500 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" /> {label}
        {s?.serverTag && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {s.serverTag}
          </span>
        )}
      </div>

      <div className="mt-1 text-sm font-semibold text-gray-900 truncate">
        {s?.title || "Training Session"}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <RoleBox
          label="Host"
          userId={s?.hostId}
          profile={s?.hostId ? names[s.hostId] : null}
          avatar={s?.hostId ? thumbs[s.hostId] : ""}
          mine={me?.userId && s?.hostId === me.userId}
          onClaim={() => s && onClaim(s.id, "host")}
          onUnclaim={() => s && onUnclaim(s.id, "host")}
          busy={busy}
        />
        <RoleBox
          label="Co-Host"
          userId={s?.cohostId}
          profile={s?.cohostId ? names[s.cohostId] : null}
          avatar={s?.cohostId ? thumbs[s.cohostId] : ""}
          mine={me?.userId && s?.cohostId === me.userId}
          onClaim={() => s && onClaim(s.id, "cohost")}
          onUnclaim={() => s && onUnclaim(s.id, "cohost")}
          busy={busy}
        />
      </div>

      {!s && (
        <div className="mt-2 text-[11px] text-gray-500">
          (No session created for this slot)
        </div>
      )}
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
              {(profile?.displayName || profile?.username || String(userId)).slice(0,1).toUpperCase()}
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
            <span className="ml-auto text-[11px] px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
              Taken
            </span>
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

/* ---------- helpers ---------- */

function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay();                 // 0 Sun..6 Sat
  const diff = (dow === 0 ? -6 : 1 - dow); // back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
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

function sameMinute(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate() && a.getHours()===b.getHours() && a.getMinutes()===b.getMinutes();
}

/**
 * Create one slot for a given local date and an EST hour.
 * We create a date for that calendar day at the EST hour, then convert to UTC ISO.
 * Display label is fixed "HH:MM AM/PM EST".
 */
function estSlotForDay(localDay, estHour) {
  // Build a Date in the America/New_York time zone for that day/hour, then convert to UTC.
  const y = localDay.getFullYear();
  const m = localDay.getMonth();
  const d = localDay.getDate();

  // Use Intl to compute the UTC instant that corresponds to that EST wall time
  const est = new Date(
    new Date(Date.UTC(y, m, d, estHour, 0, 0))
      .toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  // `est` is a local-time date; get the actual UTC instant by parsing again:
  const startUTC = new Date(Date.UTC(est.getFullYear(), est.getMonth(), est.getDate(), est.getHours(), est.getMinutes(), 0));
  const endUTC   = new Date(startUTC.getTime() + 2 * 60 * 60 * 1000); // 2h block (adjust if needed)

  const label = toESTLabel(startUTC);
  return { startUTC, endUTC, label };
}

function toESTLabel(utcDate) {
  const s = utcDate.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "2-digit"
  });
  return `${s} EST`;
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

/* ---------- Week strip ---------- */
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
