import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AccessGate({ children }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("surfari_token");
    console.log("AccessGate token:", token); // Debugging line

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
    const contentType = res.headers.get("content-type");

    if (!res.ok) {
      const error = contentType?.includes("application/json")
        ? await res.json()
        : await res.text(); // fallback if HTML (e.g., 404)

      throw new Error(error?.error || error || "Unknown error");
    }

    return contentType?.includes("application/json")
      ? res.json()
      : Promise.reject("Unexpected non-JSON response");
  })
  .then(() => setLoading(false))
  .catch(err => {
    console.error("Verify error:", err.message || err);
    localStorage.removeItem("surfari_token");
    navigate("/access-denied");
  });

  }, []);

  if (loading) return <div className="p-6">Checking access...</div>;
  return <>{children}</>;
}
