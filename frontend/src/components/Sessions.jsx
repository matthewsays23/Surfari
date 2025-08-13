// src/components/SessionsGrid.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCcw, Plus, X,
  Crown, ShieldCheck, UserPlus, UserMinus
} from "lucide-react";

const API = "https://surfari.onrender.com";
const EST_SLOTS = [0, 3, 6, 9, 12, 15, 18, 21]; // hour starts in EST (2h blocks)

export default function SessionsGrid() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date())); // Monday 00:00
  const [sessions, setSessions] = useState([]); // [{id,start,end,title,hostId,cohostId,trainerIds,serverTag}]
  const [me, setMe] = useState(null);
  const [names, setNames] = useState({});
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // { session }
  const tick = useRef(null);

  // who am I?
  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) return;
    fetch(`${API}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  // load for week (and refresh)
  useEffect(() => {
    loadWeek();
    clearInterval(tick.current);
    tick.current = setInterval(loadWeek, 30_000);
    return () => clearInterval(tick.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function loadWeek() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ weekStart: weekStart.toISOString() });
      const res = await fetch(`${API}/sessions?${qs}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);

      // hydrate identities shown in grid
      const ids = new Set();
      data.forEach(s => {
        if (s.hostId) ids.add(s.hostId);
        if (s.cohostId) ids.add(s.cohostId);
        (s.trainerIds || []).forEach(t => ids.add(t));
      });
      if (ids.size) {
        const list = [...ids];
        const [u, t] = await Promise.all([
          fetch(`${API}/roblox/users?ids=${list.join(",")}`).then(r => r.json()),
          fetch(`${API}/roblox/thumbs?ids=${list.join(",")}`).then(r => r.json()),
        ]);
        const nm = {};
        (u || []).forEach(x => nm[x.id] = { username: x.name, displayName: x.displayName || x.name });
        setNames(nm);
        const tm = {};
        (t?.data || []).forEach(d => { if (d?.targetId) tm[d.targetId] = d.imageUrl || ""; });
        setThumbs(tm);
      } else { setNames({}); setThumbs({}); }
    } finally {
      setLoading(false);
    }
  }

  // board model: 7 columns x 8 rows
  const grid = useMemo(() => {
    const cols = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(weekStart, d);
      const items = EST_SLOTS.map(h => {
        const { startUTC, endUTC, label } = estSlotForDay(day, h);
        const s = sessions.find(x => sameMinute(new Date(x.start), startUTC));
        return { startUTC, endUTC, label, session: s || null };
      });
      cols.push({ day, items });
    }
    return cols;
  }, [weekStart, sessions]);

  async function claim(sessionId, role, userIdOverride) {
    const token = localStorage.getItem("surfari_token");
    const body = JSON.stringify({ sessionId, role, userId: userIdOverride });
    await fetch(`${API}/sessions/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body
    }).then(r => r.json());
    await loadWeek();
  }
  async function unclaim(sessionId, role, userIdOverride) {
    const token = localStorage.getItem("surfari_token");
    const body = JSON.stringify({ sessionId, role, userId: userIdOverride });
    await fetch(`${API}/sessions/unclaim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body
    }).then(r => r.json());
    await loadWeek();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
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
          <WeekPills start={weekStart} />
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
                  className="p-2 rounded-xl border border-orange-200 hover:bg-orange-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekStart(getWeekStart(new Date()))}
                  className="px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50 text-sm">
            Today
          </button>
          <button onClick={loadWeek}
                  className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Column headers (days) */}
      <div className="grid grid-cols-8 gap-3">
        <div />{/* top-left empty (time column) */}
        {grid.map((c) => {
          const isToday = sameDay(c.day, new Date());
          return (
            <div key={c.day.toISOString()}
                 className={`rounded-xl px-2 py-2 text-center text-sm font-semibold
                 ${isToday ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}>
              {c.day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
            </div>
          );
        })}
      </div>

      {/* Time rows */}
      {EST_SLOTS.map((hour) => (
        <div key={hour} className="grid grid-cols-8 gap-3 items-start">
          {/* Time label column */}
          <div className="sticky left-0 z-10 rounded-xl bg-white border border-orange-100 p-3 text-sm font-medium text-gray-800">
            {fmtEST(hour)} EST
          </div>

          {/* Day cells */}
          {grid.map((c) => {
            const slot = c.items.find(i => getESTHour(i.startUTC) === hour);
            const s = slot?.session;
            const host   = s?.hostId   ? person(s.hostId, names, thumbs)   : null;
            const cohost = s?.cohostId ? person(s.cohostId, names, thumbs) : null;
            const trainers = (s?.trainerIds || []).map(id => person(id, names, thumbs)).slice(0, 4);

            return (
              <div key={c.day.toISOString()}
                   className="rounded-2xl border border-orange-100 bg-white p-2 hover:shadow-md transition relative">
                <div className="flex items-center gap-1">
                  {host ? <Avatar img={host.img} crown /> : <AvatarEmpty />}
                  {cohost ? <Avatar img={cohost.img} shield /> : <AvatarEmpty />}
                  {trainers.map((t, i) => <Avatar key={i} img={t.img} />)}
                  {(s?.trainerIds?.length || 0) > 4 && (
                    <span className="ml-1 text-[11px] text-gray-500">+{s.trainerIds.length - 4}</span>
                  )}
                  {s && (
                    <button
                      onClick={() => setDrawer({ session: s, label: slot.label })}
                      className="ml-auto text-xs px-2 py-1 rounded-md border border-orange-200 hover:bg-orange-50"
                    >
                      Details
                    </button>
                  )}
                  {!s && (
                    <span className="ml-auto text-xs text-gray-400">No session</span>
                  )}
                </div>

                {s && (
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {s.title || "Training Session"}
                    </div>
                    <button
                      onClick={() => me && claim(s.id, "trainer")}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-orange-200 hover:bg-orange-50"
                      title="Claim as Trainer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Claim
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {drawer && (
        <RightDrawer onClose={() => setDrawer(null)} title={drawer.session.title || drawer.label} subtitle={drawer.label}>
          <SessionRoles
            s={drawer.session}
            me={me}
            names={names}
            thumbs={thumbs}
            onClaim={claim}
            onUnclaim={unclaim}
          />
        </RightDrawer>
      )}
    </div>
  );
}

/* —— Drawer content —— */
function SessionRoles({ s, me, names, thumbs, onClaim, onUnclaim }) {
  const host   = s.hostId   ? person(s.hostId, names, thumbs)   : null;
  const cohost = s.cohostId ? person(s.cohostId, names, thumbs) : null;
  const trainers = (s.trainerIds || []).map(id => person(id, names, thumbs));

  const mineHost = me?.userId && s.hostId === me.userId;
  const mineCohost = me?.userId && s.cohostId === me.userId;
  const mineTrainer = me?.userId && (s.trainerIds || []).includes(me.userId);

  return (
    <div className="space-y-5">
      <RoleRow
        icon={<Crown className="w-4 h-4 text-yellow-600" />}
        label="Host"
        user={host}
        filled={!!s.hostId}
        onClaim={() => onClaim(s.id, "host")}
        onUnclaim={() => onUnclaim(s.id, "host", me?.userId)}
        mine={mineHost}
      />
      <RoleRow
        icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        label="Co-Host"
        user={cohost}
        filled={!!s.cohostId}
        onClaim={() => onClaim(s.id, "cohost")}
        onUnclaim={() => onUnclaim(s.id, "cohost", me?.userId)}
        mine={mineCohost}
      />

      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Trainers</div>
        <div className="space-y-2">
          {trainers.length === 0 && <div className="text-xs text-gray-500">No trainers yet.</div>}
          {trainers.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <img src={t.img || ""} className="h-7 w-7 rounded-md border border-orange-100 object-cover" alt="" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{t.display || `User ${t.id}`}</div>
                <div className="text-[11px] text-gray-500">@{t.name || t.id}</div>
              </div>
              {(me?.userId === t.id || mineTrainer) && (
                <button
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
          onClick={() => onClaim(s.id, "trainer")}
          className="mt-3 inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-orange-200 hover:bg-orange-50"
        >
          <UserPlus className="w-4 h-4" /> Claim as Trainer
        </button>
      </div>
    </div>
  );
}

/* —— UI bits —— */
function WeekPills({ start }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div className="flex items-center gap-1">
      {days.map(d => {
        const isToday = sameDay(d, today);
        return (
          <div key={d.toISOString()}
               className={`w-9 h-9 grid place-items-center rounded-lg text-sm
               ${isToday ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}>
            {d.getDate()}
          </div>
        );
      })}
    </div>
  );
}
function RightDrawer({ title, subtitle, onClose, children }) {
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
function Avatar({ img, crown, shield }) {
  return (
    <div className="relative">
      <img src={img || ""} className="h-7 w-7 rounded-md border border-orange-100 object-cover" alt="" />
      {crown && <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" />}
      {shield && <ShieldCheck className="absolute -top-1 -right-1 w-3 h-3 text-emerald-600" />}
    </div>
  );
}
function AvatarEmpty() {
  return <div className="h-7 w-7 rounded-md border border-dashed border-orange-200" />;
}
function RoleRow({ icon, label, user, filled, onClaim, onUnclaim, mine }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white/80 p-3 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      {filled ? (
        <>
          <img src={user?.img || ""} className="h-8 w-8 rounded-md border border-orange-100 object-cover" alt="" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.display || "User"}</div>
            <div className="text-[11px] text-gray-500">@{user?.name}</div>
          </div>
          {mine ? (
            <button onClick={onUnclaim}
                    className="ml-auto text-[12px] px-2.5 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50">
              Unclaim
            </button>
          ) : (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">Taken</span>
          )}
        </>
      ) : (
        <>
          <div className="text-sm text-gray-700">{label}</div>
          <button onClick={onClaim}
                  className="ml-auto inline-flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-orange-200 hover:bg-orange-50">
            Claim {label}
          </button>
        </>
      )}
    </div>
  );
}

/* —— time helpers —— */
function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0 Sun..6 Sat
  const diff = (dow === 0 ? -6 : 1 - dow); // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function sameMinute(a,b){ return a.getTime() === b.getTime(); }
function fmtEST(hour){ const h=((hour+11)%12)+1; const ampm=hour<12?"AM":"PM"; return `${String(h).padStart(2,"0")}:00 ${ampm}`; }
function getESTHour(utc){ return new Date(utc).toLocaleString("en-US",{timeZone:"America/New_York",hour:"numeric",hour12:false})*1; }
function estSlotForDay(localDay, estHour){
  // construct EST wall-clock then convert to UTC
  const y=localDay.getFullYear(), m=localDay.getMonth(), d=localDay.getDate();
  const estLocal = new Date(`${y}-${m+1}-${d}T${String(estHour).padStart(2,"0")}:00:00`);
  const startUTC = new Date(estLocal.toLocaleString("en-US",{timeZone:"UTC"}));
  const endUTC = new Date(startUTC.getTime()+2*60*60*1000);
  const label = new Date(startUTC).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit"})+" EST";
  return { startUTC, endUTC, label };
}
function person(id, names, thumbs){
  const n = names[id] || {};
  return { id, name: n.username, display: n.displayName || n.username || `User ${id}`, img: thumbs[id] || "" };
}
