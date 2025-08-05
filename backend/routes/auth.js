import express from "express";
import axios from "axios";
import { MongoClient } from "mongodb";

const router = express.Router();
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db("surfari");
const sessions = db.collection("sessions");

const GROUP_ID = parseInt(process.env.SURFARI_GROUP_ID);
const ADMIN_ROLE_IDS = process.env.SURFARI_ADMIN_ROLES.split(",").map(Number);

// --- ROBLOX LOGIN REDIRECT ---
router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const scope = "openid profile";

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(robloxAuthUrl);
});

// --- CALLBACK HANDLER ---
router.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await axios.post(
      "https://apis.roblox.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;

    // Step 2: Fetch user info
    const userInfo = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const robloxUser = userInfo.data;
    const token = `token-${robloxUser.sub}-${Date.now()}`;

    // Step 3: Store session in MongoDB
    await sessions.insertOne({
      token,
      userId: robloxUser.sub,
      createdAt: new Date(),
    });

    // Step 4: Redirect with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

// --- VERIFY ACCESS ---
router.get("/verify", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const session = await sessions.findOne({ token });
    if (!session) return res.status(403).json({ error: "Invalid token" });

    const userId = session.userId;

    // Check group admin access
    const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups`);
    const groups = groupRes.data.data;

    const surfariGroup = groups.find(g => g.group.id === GROUP_ID);
    if (!surfariGroup || !ADMIN_ROLE_IDS.includes(surfariGroup.role.rank)) {
      return res.status(403).json({ error: "User not an admin" });
    }

    res.json({ status: "Access granted", userId });
  } catch (err) {
    console.error("Verify error:", err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;

