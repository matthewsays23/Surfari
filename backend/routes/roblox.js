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

    const { data } = await axios.get("https://thumbnails.roblox.com/v1/users/avatar-headshot", {
      params: {
        userIds: ids.join(","),
        size: "150x150",
        format: "Png",
        isCircular: "false",
      },
      // timeout: 5000,
    });

    res.json(data);
  } catch (e) {
    console.error("thumbs proxy error:", e.response?.data || e.message);
    res.status(500).json({ error: "Thumbs fetch failed" });
  }
});

export default router;
