import { Router } from "express";
import { runAgent } from "../agent/agent.js";
import { requireSession } from "../auth/session.js";

export function createChatRouter(agent = runAgent) {
  const chatRouter = Router();

  chatRouter.post("/", requireSession, async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message es requerido" });
    }

    try {
      const result = await agent({ userId: req.userId, message });
      res.json(result);
    } catch (err) {
      console.error("[chat] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return chatRouter;
}
