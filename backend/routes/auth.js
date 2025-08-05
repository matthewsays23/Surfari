import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

const router = express.Router();

// Step 1: Redirect user to Roblox auth page
router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const scope = "openid profile";

  const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(authUrl);
});

// Step 2: Handle Roblox OAuth callback
router.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    const response = await axios.post(
      "https://apis.roblox.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token } = response.data;

    const userInfo = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const robloxUser = userInfo.data;

    // TODO: Generate JWT or session token here
    const token = "mock-token-for-" + robloxUser.sub;

    return res.json({ token });
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    return res.status(500).json({ error: "OAuth callback failed" });
  }
});

export default router;
