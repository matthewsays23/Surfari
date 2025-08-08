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
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = response.data;
    const userInfo = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const robloxUser = userInfo.data;
    const token = "token-" + robloxUser.sub + "-" + Date.now();

    // Save session in MongoDB
    await sessions.insertOne({ token, userId: robloxUser.sub, createdAt: new Date() });

    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    return res.status(500).json({ error: "OAuth callback failed" });
  }
});


router.get("/verify", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  const session = await sessions.findOne({ token });
  const userId = session?.userId;
  if (!userId) return res.status(403).json({ error: "Invalid token" });

  try {
    const response = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
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

async function getGroupRole(userId) {
  try {
    const { data } = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const match = (data.data || []).find(g => g.group?.id === GROUP_ID);
    if (!match) return { roleName: "Not in group", roleRank: 0 };
    return { roleName: match.role?.name ?? "Member", roleRank: match.role?.rank ?? 0 };
  } catch {
    return { roleName: "Unknown", roleRank: -1 };
  }
}


router.get("/team", async (req, res) => {
  const ids = process.env.SURFARI_ADMIN_USER_IDS.split(",").map(id => parseInt(id.trim(), 10));
  const rows = await Promise.all(
    ids.map(async id => {
      const { data } = await axios.get("https://users.roblox.com/v1/users/${id}");
      const roleData = await getGroupRole(id);
      return {
        userId: id,
        username: data.name,
        displayName: data.displayName,
        roleName: roleData.roleName,
        roleRank: roleData.roleRank
      };
    })
  );
  res.json(rows);
});

// ==== TEAM LIST (public read) ====
// Add a comma-separated list of admin user IDs to your env:
// SURFARI_ADMIN_USER_IDS=4872645848,123456,987654
const ADMIN_USER_IDS = (process.env.SURFARI_ADMIN_USER_IDS || "")
  .split(",")
  .map(v => parseInt(v.trim(), 10))
  .filter(Boolean);

// Returns [{ userId, username, displayName, role: "Admin" }]
router.get("/team", async (req, res) => {
  try {
    if (!ADMIN_USER_IDS.length) return res.json([]);

    // Fetch Roblox user info for each ID (users.roblox.com works without auth)
    const results = await Promise.all(
      ADMIN_USER_IDS.map(async (id) => {
        try {
          const { data } = await axios.get(`https://users.roblox.com/v1/users/${id}`);
          return {
            userId: id,
            username: data?.name || `User_${id}`,
            displayName: data?.displayName || data?.name || `User_${id}`,
            role: "Admin",
          };
        } catch {
          return { userId: id, username: `User_${id}`, displayName: `User_${id}`, role: "Admin" };
        }
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Team list error:", err.message);
    res.status(500).json({ error: "Failed to load team" });
  }
});

export default router;

