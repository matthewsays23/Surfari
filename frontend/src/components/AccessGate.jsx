import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AccessGate({ children }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    if (!token) {
      window.location.href = "https://surfari.onrender.com/auth/roblox";
      return;
    }

    fetch("https://surfari.onrender.com/auth/verify", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then(async res => {
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      const error = contentType?.includes("application/json")
        ? await res.json()
        : await res.text(); // fallback for HTML errors

      throw new Error(error?.error || error);
    }
    return res.json(); // only try JSON if successful
  })
  .then(() => setLoading(false))
  .catch(err => {
    console.error("Verify error:", err);
    localStorage.removeItem("surfari_token");
    navigate("/access-denied");
  });
  }, []);

  if (loading) return <div className="p-6">Checking access...</div>;
  return <>{children}</>;
}
