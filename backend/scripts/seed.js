import "dotenv/config";
import { connectDB } from "../src/db/connection.js";
import { User } from "../src/db/models/User.js";
import { CreditAccount } from "../src/db/models/CreditAccount.js";
import mongoose from "mongoose";

async function seed() {
  await connectDB();

  const user = await User.findOneAndUpdate(
    { userId: "demo-user" },
    { $setOnInsert: { userId: "demo-user", name: "Ana", generalPrompt: "Ana no tiene movimientos recientes registrados." } },
    { upsert: true, new: true }
  );
  await CreditAccount.findOneAndUpdate(
    { userId: user.userId },
    {
      $setOnInsert: {
        userId: user.userId,
        cardLastFour: "4821",
        balance: 18400,
        currentRate: 36.0,
        // Datos de ejemplo para la gráfica de evolución del saldo — no
        // vienen de movimientos reales, es contexto visual del demo.
        balanceHistory: [
          { label: "Abr", balance: 11200 },
          { label: "May", balance: 12800 },
          { label: "Jun", balance: 13500 },
          { label: "Jul", balance: 15100 },
          { label: "Ago", balance: 17100 },
          { label: "Sep", balance: 18400 },
        ],
      },
    },
    { upsert: true }
  );

  console.log("[seed] usuario demo creado: demo-user (saldo $18,400)");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});