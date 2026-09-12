import "dotenv/config";
import { connectDB } from "../src/db/connection.js";
import { User } from "../src/db/models/User.js";
import { CreditAccount } from "../src/db/models/CreditAccount.js";
import mongoose from "mongoose";

async function seed() {
  await connectDB();

  await User.updateOne(
    { userId: "demo-user" },
    {
      $setOnInsert: {
        userId: "demo-user",
        name: "Ana",
        generalPrompt: "Ana no tiene movimientos recientes registrados.",
      },
    },
    { upsert: true }
  );

  await CreditAccount.updateOne(
    { userId: "demo-user" },
    {
      $setOnInsert: {
        userId: "demo-user",
        cardLastFour: "4821",
        balance: 18400,
        currentRate: 36.0,
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
