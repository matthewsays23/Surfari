import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AccessGate({ children }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) {
      window.location.href = "https://surfari-backend.onrender.com/auth/roblox";
      return;
    }

    fetch("https://surfari-backend.onrender.com/auth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not authorized");
        return res.json();
      })
      .then(() => setLoading(false))
      .catch(() => {
        localStorage.removeItem("surfari_token");
        navigate("/access-denied");
      });
  }, []);

  if (loading) return <div className="p-6">Checking access...</div>;
  return <>{children}</>;
}
