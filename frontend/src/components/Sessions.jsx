// src/components/Sessions.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCcw, CalendarDays, Clock,
  UserPlus, UserMinus, X, UserCircle2, Plus, Crown, ShieldCheck
} from "lucide-react";

const API = "https://surfari.onrender.com";
const REFRESH_MS = 30_000;
const EST_SLOTS = [0, 3, 6, 9, 12, 15, 18, 21]; // hours

export default function Sessions() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [sessions, setSessions]   = useState([]);
  const [me, setMe]               = useState(null);
  const [names, setNames]         = useState({});
  const [thumbs, setThumbs]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(false);
  const [open, setOpen]           = useState(null); // {session, slotLabel}
  const refreshRef = useRef(null);

  // identify current user
  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) return;
    fetch(`${API}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

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

      const ids = new Set();
      data.forEach(s => {
        if (s.hostId) ids.add(s.hostId);
        if (s.cohostId) ids.add(s.cohostId);
        (s.trainerIds || []).forEach(t => ids.add(t));
      });
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

  // build week columns
  const columns = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const col = { day, slots: [] };
      for (const hour of EST_SLOTS) {
        const { startUTC, endUTC, label } = estSlotForDay(day, hour);
        const session = sessions.find(s => sameMinute(new Date(s.start), startUTC));
        col.slots.push({ startUTC, endUTC, label, session });
      }
      out.push(col);
    }
    return out;
  }, [weekStart, sessions]);

  // claim / unclaim helpers
  async function claim(sessionId, role) {
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      await safeJson(fetch(`${API}/sessions/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, role }) // role: "host" | "cohost" | "trainer"
      }));
      await loadBoard();
    } finally { setBusy(false); }
  }
  async function unclaim(sessionId, role, userId) {
    setBusy(true);
    const token = localStorage.getItem("surfari_token");
    try {
      await safeJson(fetch(`${API}/sessions/unclaim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, role, userId }) // for trainer, include userId to remove
      }));
      await loadBoard();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-white/90 to-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 rounded-xl border border-orange-100 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-600" />
            <div>
              <div className="text-xs text-gray-500">
                Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
              <div className="text-lg font-semibold text-gray-900">Sessions</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
                    className="p-2 rounded-xl border border-orange-200 hover:bg-orange-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <WeekStrip weekStart={weekStart} />
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
                    className="p-2 rounded-xl border border-orange-200 hover:bg-orange-50">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setWeekStart(getWeekStart(new Date()))}
                    className="ml-2 px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50 text-sm">
              Today
            </button>
            <button onClick={loadBoard}
                    className="ml-2 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50"
                    disabled={loading}>
              <RefreshCcw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {columns.map((col, idx) => {
          const isToday = sameDay(col.day, new Date());
          return (
            <div key={idx} className={`rounded-2xl border ${isToday ? "border-orange-300" : "border-orange-100"} bg-white p-3 shadow-sm`}>
              <header className="mb-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {col.day.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? "text-orange-700" : "text-gray-900"}`}>
                  {col.day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </header>

              {loading ? (
                <div className="space-y-3">
                  {EST_SLOTS.map((_, i) => (
                    <div key={i} className="h-24 rounded-xl border border-orange-100 bg-orange-50/40 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {col.slots.map((slot, k) => (
                    <SessionCard
                      key={k}
                      slot={slot}
                      names={names}
                      thumbs={thumbs}
                      onOpen={() => setOpen({ session: slot.session, slotLabel: slot.label })}
                      me={me}
                      onQuickClaim={() => slot.session && claim(slot.session.id, "trainer")}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drawer / Modal */}
      {open && (
        <SessionDrawer
          open={open}
          onClose={() => setOpen(null)}
          names={names} thumbs={thumbs} me={me}
          onClaim={claim} onUnclaim={unclaim} busy={busy}
        />
      )}
    </div>
  );
}

/* ============ Cards & Drawer ============ */

function SessionCard({ slot, names, thumbs, onOpen, me, onQuickClaim }) {
  const s = slot.session;
  const host   = s?.hostId ? infoFor(s.hostId, names, thumbs) : null;
  const cohost = s?.cohostId ? infoFor(s.cohostId, names, thumbs) : null;
  const trainers = (s?.trainerIds || []).map(id => infoFor(id, names, thumbs)).slice(0, 3); // show up to 3

  return (
    <div className="group rounded-xl border border-orange-100 bg-gradient-to-b from-orange-50/50 to-emerald-50/40 p-3 hover:shadow-md transition">
      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {slot.label}</div>
        {s?.serverTag && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{s.serverTag}</span>}
      </div>

      <div className="mt-1 text-sm font-semibold text-gray-900 truncate">
        {s?.title || "Training Session"}
      </div>

      {/* Avatar strip */}
      <div className="mt-3 flex items-center gap-1">
        {host ? <Avatar img={host.img} label="Host" crown /> : <AvatarEmpty label="Host" />}
        {cohost ? <Avatar img={cohost.img} label="Co-Host" shield /> : <AvatarEmpty label="Co-Host" />}
        {trainers.map((t, i) => <Avatar key={i} img={t.img} />)}
        {(s?.trainerIds?.length || 0) > 3 && (
          <span className="ml-1 text-[11px] text-gray-600">+{s.trainerIds.length - 3}</span>
        )}

        {/* Quick claim shows on hover if session exists */}
        {s && (
          <button
            onClick={onQuickClaim}
            className="ml-auto opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-orange-200 hover:bg-orange-50 transition"
            title="Claim as trainer"
          >
            <Plus className="w-3.5 h-3.5" /> Claim
          </button>
        )}
      </div>

      {/* Click opens drawer */}
      <button onClick={onOpen} className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        <span className="sr-only">Open session</span>
      </button>
    </div>
  );
}

function SessionDrawer({ open, onClose, names, thumbs, me, onClaim, onUnclaim, busy }) {
  const s = open.session;
  if (!s) {
    return (
      <SideDrawer title={open.slotLabel} onClose={onClose}>
        <p className="text-sm text-gray-600">No session created for this slot.</p>
      </SideDrawer>
    );
  }
  const host   = s.hostId   ? infoFor(s.hostId, names, thumbs)   : null;
  const cohost = s.cohostId ? infoFor(s.cohostId, names, thumbs) : null;
  const trainers = (s.trainerIds || []).map(id => infoFor(id, names, thumbs));

  const mineHost   = me?.userId && s.hostId   === me.userId;
  const mineCohost = me?.userId && s.cohostId === me.userId;
  const mineTrainer = me?.userId && (s.trainerIds || []).includes(me.userId);

  return (
    <SideDrawer title={s.title || open.slotLabel} subtitle={open.slotLabel} onClose={onClose}>
      <section className="space-y-5">
        <RoleRow
          icon={<Crown className="w-4 h-4 text-yellow-600" />}
          label="Host"
          user={host}
          filled={!!s.hostId}
          onClaim={() => onClaim(s.id, "host")}
          onUnclaim={() => onUnclaim(s.id, "host", me?.userId)}
          mine={mineHost}
          busy={busy}
        />
        <RoleRow
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
          label="Co-Host"
          user={cohost}
          filled={!!s.cohostId}
          onClaim={() => onClaim(s.id, "cohost")}
          onUnclaim={() => onUnclaim(s.id, "cohost", me?.userId)}
          mine={mineCohost}
          busy={busy}
        />

        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Trainers</div>
          <div className="space-y-2">
            {trainers.length === 0 && (
              <div className="text-xs text-gray-500">No trainers yet.</div>
            )}
            {trainers.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <img src={t.img || ""} alt={t.name || t.id} className="h-7 w-7 rounded-md border border-orange-100 object-cover" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{t.display || `User ${t.id}`}</div>
                  <div className="text-[11px] text-gray-500 truncate">@{t.name || t.id}</div>
                </div>
                {(me?.userId === t.id || mineTrainer) && (
                  <button
                    disabled={busy}
                    onClick={() => onUnclaim(s.id, "trainer", t.id)}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            disabled={busy}
            onClick={() => onClaim(s.id, "trainer")}
            className="mt-3 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50"
          >
            <UserPlus className="w-4 h-4" /> Claim as Trainer
          </button>
        </div>
      </section>
    </SideDrawer>
  );
}

/* ============ UI Bits ============ */

function Avatar({ img, label, crown, shield }) {
  return (
    <div className="relative">
      <img src={img || ""} className="h-7 w-7 rounded-md border border-orange-100 object-cover" alt="" />
      {crown && <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500 drop-shadow" />}
      {shield && <ShieldCheck className="absolute -top-1 -right-1 w-3 h-3 text-emerald-600 drop-shadow" />}
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
function AvatarEmpty({ label }) {
  return (
    <div className="h-7 w-7 rounded-md grid place-items-center border border-dashed border-orange-200 text-orange-400 bg-white/70">
      <UserCircle2 className="w-4 h-4" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function RoleRow({ icon, label, user, filled, onClaim, onUnclaim, mine, busy }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white/80 p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      {filled ? (
        <>
          <img src={user?.img || ""} alt={user?.name || ""}
               className="h-8 w-8 rounded-md border border-orange-100 object-cover" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.display || "User"}</div>
            <div className="text-[11px] text-gray-500">@{user?.name}</div>
          </div>
          {mine ? (
            <button
              disabled={busy}
              onClick={onUnclaim}
              className="ml-auto inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
            >
              <UserMinus className="w-3.5 h-3.5" /> Unclaim
            </button>
          ) : (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
              Taken
            </span>
          )}
        </>
      ) : (
        <>
          <div className="text-sm text-gray-700">{label}</div>
          <button
            disabled={busy}
            onClick={onClaim}
            className="ml-auto inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-orange-200 hover:bg-orange-50"
          >
            <UserPlus className="w-4 h-4" /> Claim {label}
          </button>
        </>
      )}
    </div>
  );
}

function SideDrawer({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md h-full bg-white shadow-xl border-l border-orange-100 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500">{subtitle}</div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border border-orange-200 hover:bg-orange-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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

/* ============ helpers ============ */

function infoFor(id, names, thumbs) {
  const n = names[id] || {};
  return { id, name: n.username, display: n.displayName || n.username || `User ${id}`, img: thumbs[id] || "" };
}

function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay();                 // 0 Sun..6 Sat
  const diff = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function sameMinute(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate() && a.getHours()===b.getHours() && a.getMinutes()===b.getMinutes();
}
function toESTLabel(utcDate) {
  const s = utcDate.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  return `${s} EST`;
}
function estSlotForDay(localDay, estHour) {
  const y = localDay.getFullYear(), m = localDay.getMonth(), d = localDay.getDate();
  const est = new Date(new Date(Date.UTC(y, m, d, estHour, 0, 0)).toLocaleString("en-US", { timeZone: "America/New_York" }));
  const startUTC = new Date(Date.UTC(est.getFullYear(), est.getMonth(), est.getDate(), est.getHours(), est.getMinutes(), 0));
  const endUTC = new Date(startUTC.getTime() + 2 * 60 * 60 * 1000);
  return { startUTC, endUTC, label: toESTLabel(startUTC) };
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
