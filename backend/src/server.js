import "dotenv/config";
import { connectDB } from "./db/connection.js";
import { initializeMcp } from "./mcp/tools.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => initializeMcp())
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => console.log(`[server] escuchando en :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] no se pudo conectar a la DB:", err);
    process.exit(1);
  });
