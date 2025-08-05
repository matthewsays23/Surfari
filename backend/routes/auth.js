import express from "express";

const router = express.Router();

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = process.env.ROBLOX_REDIRECT_URI;
  const scope = "openid profile";

  const robloxAuthUrl = `https://www.roblox.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

  res.redirect(robloxAuthUrl);
});

export default router;