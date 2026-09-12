import { Router } from "express";
import { runAgent } from "../agent/agent.js";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: "userId y message son requeridos" });
  }

  try {
    const result = await runAgent({ userId, message });
    res.json(result);
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: err.message });
  }
});
