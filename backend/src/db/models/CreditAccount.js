import mongoose from "mongoose";

const activePlanSchema = new mongoose.Schema(
  {
    months: Number,
    cat: Number,
    monthlyPayment: Number,
    appliedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const creditAccountSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  cardLastFour: { type: String, default: "4821" },
  balance: { type: Number, required: true }, // saldo actual
  currentRate: { type: Number, required: true }, // tasa de interés vigente (anual, %)
  activePlan: { type: activePlanSchema, default: null }, // plan de reestructura aplicado, si hay
});

export const CreditAccount = mongoose.model("CreditAccount", creditAccountSchema);
