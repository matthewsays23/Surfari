import express from "express";

const router = express.Router();

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = process.env.ROBLOX_REDIRECT_URI;
  const scope = "openid profile";

  // ✅ Always encode values that go into a query string
  const robloxAuthUrl = `https://www.roblox.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

  console.log("Redirecting to Roblox OAuth:", robloxAuthUrl); // ✅ Debug log
  res.redirect(robloxAuthUrl);
});

export default router;
