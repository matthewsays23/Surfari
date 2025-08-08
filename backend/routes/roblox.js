// routes/roblox.js
import express from "express";
import axios from "axios";

const router = express.Router();

// GET /roblox/thumbs?ids=123,456
router.get("/thumbs", async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({ data: [] });

    const url = "https://thumbnails.roblox.com/v1/users/avatar-headshot";
    const { data } = await axios.get(url, {
      params: {
        userIds: ids.join(","),
        size: "150x150",
        format: "Png",
        isCircular: "false",
      },
      // timeout: 5000,
    });

    res.json(data); // your server already sets CORS to allow surfari.io
  } catch (e) {
    console.error("thumbs proxy error:", e.response?.data || e.message);
    res.status(500).json({ error: "Thumbs fetch failed" });
  }
});

export default router;
