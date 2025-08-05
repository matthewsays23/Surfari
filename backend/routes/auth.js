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
  if (!code) return res.status(400).send("Missing authorization code");

  try {
    // Exchange code for token
    const tokenRes = await axios.post(
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

    const access_token = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const robloxUser = userRes.data;

    // Step 3: Create a secure session token
    const token = jwt.sign(
      {
        userId: robloxUser.sub,
        username: robloxUser.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Step 4: Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/access-denied`);
  }
});

export default router;
