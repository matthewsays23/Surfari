import express from "express";

const router = express.Router();

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid%20profile`;

  res.redirect(robloxAuthUrl);
});

export default router;
