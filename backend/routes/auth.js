import express from "express";

const router = express.Router();

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const scope = "openid profile";

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(robloxAuthUrl);
});

// You can later add this to handle the redirect:
router.get("/callback", (req, res) => {
  res.send("OAuth callback received");
});

export default router;

