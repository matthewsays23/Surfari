import React from "react";
import { ClipboardList, Calendar, Clock, Users } from "lucide-react";

const sessions = [
  {
    title: "Surfer Tryouts",
    time: "Today at 6:00 PM",
    host: "CoachLuna",
    status: "Open",
  },
  {
    title: "Advanced Wave Training",
    time: "Tomorrow at 3:00 PM",
    host: "WaveMaster",
    status: "Full",
  },
  {
    title: "Staff Briefing",
    time: "Fri at 1:00 PM",
    host: "Jason",
    status: "Completed",
  },
];

export default function Sessions() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-orange-600 flex items-center gap-2">
        <ClipboardList className="w-7 h-7" />
        Training Sessions
      </h1>

      <div className="grid gap-5">
        {sessions.map((session, i) => (
          <div
            key={i}
            className={`p-5 rounded-xl shadow-md bg-white border-l-4 ${
              session.status === "Open"
                ? "border-green-400"
                : session.status === "Full"
                ? "border-yellow-400"
                : "border-gray-300"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xl font-semibold">{session.title}</h2>
              <span
                className={`text-sm font-medium px-2 py-1 rounded-full ${
                  session.status === "Open"
                    ? "bg-green-100 text-green-700"
                    : session.status === "Full"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {session.status}
              </span>
            </div>
            <div className="text-gray-600 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> {session.time}
            </div>
            <div className="text-gray-600 text-sm flex items-center gap-2 mt-1">
              <Users className="w-4 h-4" /> Hosted by <strong>{session.host}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
