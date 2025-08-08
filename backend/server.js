import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import "./db.js"; // initialize connection once

import authRoutes from "./routes/auth.js";
import robloxRoutes from "./routes/roblox.js";

const app = express();

const ALLOW_ORIGINS = ["https://surfari.io", "http://localhost:5173"];
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    cb(null, ALLOW_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
};
app.use(cors(corsOptions));
app.use(express.json());

app.use("/auth", authRoutes);    // ✅ all relative paths
app.use("/roblox", robloxRoutes);

app.get("/", (_req, res) => res.json({ status: "Surfari backend running" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
