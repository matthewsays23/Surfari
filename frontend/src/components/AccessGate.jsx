import React, { useEffect, useState } from "react";

export default function AccessGate({ children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) {
      // No token → go to Roblox login
      window.location.href = `${import.meta.env.VITE_API_URL}/auth/roblox`;
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1])); // Decode JWT
      if (payload.isAdmin) {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch {
      setAllowed(false);
    }
  }, []);

  if (allowed === null) return <div className="p-6">Checking access...</div>;
  if (!allowed) return <div className="p-6 text-red-500">Access Denied</div>;

  return <>{children}</>;
}
