import express from "express";
import axios from "axios";

const router = express.Router();

const sessions = new Map(); // temp in-memory store
const GROUP_ID = parseInt(process.env.SURFARI_GROUP_ID);
const ADMIN_ROLE_IDS = process.env.SURFARI_ADMIN_ROLES.split(",").map(Number);

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const scope = "openid profile";

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(robloxAuthUrl);
});

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
    const token = `token-${robloxUser.sub}-${Date.now()}`;
    sessions.set(token, robloxUser.sub);

    const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?token=${token}`;
    console.log("Redirecting user to:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

router.get("/verify", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  const userId = sessions.get(token);
  if (!userId) return res.status(403).json({ error: "Invalid token" });

  try {
    const response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups`);
    const groups = response.data.data;

    const surfariGroup = groups.find(g => g.group.id === GROUP_ID);
    if (!surfariGroup || !ADMIN_ROLE_IDS.includes(surfariGroup.role.rank)) {
      return res.status(403).json({ error: "User not an admin" });
    }

    return res.json({ status: "Access granted", userId });
  } catch (err) {
    console.error("Verify error:", err.message);
    return res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
