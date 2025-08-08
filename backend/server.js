import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { db } from "./db.js";
import authRoutes from "./routes/auth.js";
import robloxRoutes from "./routes/roblox.js";

const app = express();

// CORS – allow prod + local, allow Authorization header
const ALLOW_ORIGINS = [
  "https://surfari.io",
  "http://localhost:5173",
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server, curl
    cb(null, ALLOW_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false, // using Bearer tokens, not cookies
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// mount routes
app.use("/auth", authRoutes);
app.use("/roblox", robloxRoutes);

// sanity
app.get("/", (_req, res) => res.json({ status: "Surfari backend running" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
