import { Router } from "express";
import { requireSession } from "../auth/session.js";
import { callTool } from "../mcp/tools.js";
import { User } from "../db/models/User.js";

export function createAccountRouter() {
  const accountRouter = Router();

  accountRouter.get("/", requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ userId: req.userId });
      const snapshot = await callTool("get_credit_plans", { userId: req.userId });
      res.json({ name: user?.name || "Cliente", ...snapshot });
    } catch (err) {
      console.error("[account] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return accountRouter;
}