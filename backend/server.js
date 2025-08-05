import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// ✅ Import auth routes only after env is ready
const { default: authRoutes } = await import("./routes/auth.js");
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({ status: "Surfari backend running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
