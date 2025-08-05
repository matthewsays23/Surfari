import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/access-denied");
      return;
    }

    fetch("https://surfari.onrender.com/auth/callback?code=" + code)
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem("surfari_token", data.token);
          navigate("/");
        } else {
          navigate("/access-denied");
        }
      })
      .catch(err => {
        console.error(err);
        navigate("/access-denied");
      });
  }, []);

  return <div className="p-6">Signing you in...</div>;
}