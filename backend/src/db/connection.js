import mongoose from "mongoose";

export async function connectDB() {
  const url = process.env.MONGO_URL || "mongodb://localhost:27017/banorte_credito";
  await mongoose.connect(url);
  console.log(`[DB] Conectado a Mongo: ${url}`);
}
