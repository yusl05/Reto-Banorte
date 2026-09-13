import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db/connection.js";
import { chatRouter } from "./routes/chat.js";
import { actionRouter } from "./routes/action.js";
import { sessionRouter } from "./routes/session.js";
import { initializeMcp } from "./mcp/tools.js";

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:8080")
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
app.use("/api/chat", chatRouter);
app.use("/api/action", actionRouter);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => initializeMcp())
  .then(() => {
    app.listen(PORT, () => console.log(`[server] escuchando en :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] no se pudo conectar a la DB:", err);
    process.exit(1);
  });
