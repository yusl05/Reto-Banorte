import express from "express";
import cors from "cors";
import { createChatRouter } from "./routes/chat.js";
import { createActionRouter } from "./routes/action.js";
import { sessionRouter } from "./routes/session.js";
import { runAgent } from "./agent/agent.js";

export function createApp({ agent = runAgent, frontendOrigin } = {}) {
  const app = express();
  const allowedOrigins = (frontendOrigin || process.env.FRONTEND_ORIGIN || "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((origin) => origin.trim());

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/session", sessionRouter);
  app.use("/api/chat", createChatRouter(agent));
  app.use("/api/action", createActionRouter(agent));
  app.use((error, _req, res, next) => {
    if (error.message === "Origen no permitido por CORS") {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  });

  return app;
}
