import React, { useEffect, useState } from "react";
import { Users, ShieldCheck, RefreshCcw } from "lucide-react";

export default function Team() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://surfari.onrender.com/auth/team");
      const data = await res.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Team load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Team</h2>
            <p className="text-sm text-gray-500">Admins with access to Surfari</p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-orange-200 hover:bg-orange-50 transition"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-orange-100 bg-white/60 animate-pulse" />
          ))}
        </div>
      ) : admins.length === 0 ? (
        <div className="rounded-2xl border border-orange-100 bg-white/80 p-6 text-center text-sm text-gray-600">
          No admins configured yet. Add IDs to <code className="px-1 py-0.5 bg-orange-50 rounded">SURFARI_ADMIN_USER_IDS</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {admins.map((a) => (
            <div key={a.userId} className="rounded-2xl border border-orange-100 bg-white/90 p-5 hover:shadow-md transition">
              <div className="flex items-center gap-4">
                {/* Roblox avatar via thumbnail API */}
                <img
                  className="h-12 w-12 rounded-xl object-cover border border-orange-100"
                  src={`https://www.roblox.com/headshot-thumbnail/image?userId=${a.userId}&width=150&height=150&format=png`}
                  alt={a.username}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate">{a.displayName}</span>
                    <span title="Admin" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="w-3 h-3" /> {a.role}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">@{a.username} · ID {a.userId}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
