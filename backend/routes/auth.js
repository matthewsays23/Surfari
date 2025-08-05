import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/roblox", (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const scope = "openid profile";

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(robloxAuthUrl);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing authorization code");

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
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token } = response.data;

    // Now use access_token to fetch Roblox user info
    const userInfo = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // ✅ You now have the user's Roblox info
    const robloxUser = userInfo.data;
    console.log("Roblox user:", robloxUser);

    // Redirect to frontend with user info, or session token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?userId=${robloxUser.sub}`);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;
