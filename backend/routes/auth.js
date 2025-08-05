import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send("Missing code");

  try {
    const response = await axios.post("https://apis.roblox.com/oauth/v1/token", null, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      params: {
        grant_type: "authorization_code",
        code,
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
      },
    });

    const access_token = response.data.access_token;

    // Optionally fetch user profile
    const profile = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const user = profile.data;
    // You can now verify roles/group/etc here

    res.redirect(`${process.env.FRONTEND_URL}/auth/success?user=${user.name}`);
  } catch (err) {
    console.error("OAuth callback error:", err?.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/access-denied`);
  }
});

export default router;
