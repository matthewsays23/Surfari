import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("surfari_token", token);
      navigate("/"); // Go to dashboard
    } else {
      navigate("/access-denied");
    }
  }, []);

  return <div className="p-6">Signing you in...</div>;
}
