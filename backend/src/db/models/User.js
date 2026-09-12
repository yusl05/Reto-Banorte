import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    intent: String, // qué quería lograr el usuario
    action: String, // qué acción real se disparó (o null si solo fue consulta)
    summary: String, // una línea humana para inyectar al prompt general
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  // "prompt general" vivo del usuario: se re-genera con base en recentActivity
  generalPrompt: { type: String, default: "" },
  // solo guardamos los últimos N movimientos, como dice el pizarrón
  recentActivity: { type: [activitySchema], default: [] },
});

const MAX_ACTIVITY = 8;

userSchema.methods.pushActivity = function (entry) {
  this.recentActivity.unshift(entry);
  this.recentActivity = this.recentActivity.slice(0, MAX_ACTIVITY);
  this.generalPrompt = buildGeneralPrompt(this);
};

function buildGeneralPrompt(user) {
  if (!user.recentActivity.length) {
    return `${user.name} no tiene movimientos recientes registrados.`;
  }
  const lineas = user.recentActivity
    .map((a) => `- ${a.summary}`)
    .join("\n");
  return `Contexto reciente de ${user.name} (más nuevo primero):\n${lineas}`;
}

export const User = mongoose.model("User", userSchema);
