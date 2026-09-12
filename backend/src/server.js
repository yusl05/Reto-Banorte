import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db/connection.js";
import { chatRouter } from "./routes/chat.js";
import { actionRouter } from "./routes/action.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/chat", chatRouter);
app.use("/api/action", actionRouter);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] escuchando en :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] no se pudo conectar a la DB:", err);
    process.exit(1);
  });
