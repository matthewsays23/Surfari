import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

const router = express.Router();

// ✅ Handle missing SURFARI_ADMIN_ROLES gracefully
const ADMIN_ROLE_IDS = (process.env.SURFARI_ADMIN_ROLES || "")
  .split(",")
  .filter(Boolean)
  .map(r => parseInt(r));

console.log("Loaded ADMIN_ROLE_IDS:", ADMIN_ROLE_IDS); // debug log

router.get("/test", (req, res) => {
  res.json({ message: "Auth route working", roles: ADMIN_ROLE_IDS });
});

export default router;
