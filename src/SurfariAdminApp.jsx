import React, { useState } from "react";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import HomeScreen from "./components/HomeScreen";
import Sessions from "./components/Sessions";
import ActivityPage from "./components/Activity";

export default function SurfariAdminApp() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="min-h-screen bg-[linear-gradient(120deg,#fff7ed_0%,#ecfeff_100%)]">
      <Topbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex gap-6">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 py-8">
          {activeTab === "home" && <HomeScreen />}
          {activeTab === "sessions" && <Sessions />}
          {activeTab === "activity" && <ActivityPage />}
        </main>
      </div>
    </div>
  );
}
