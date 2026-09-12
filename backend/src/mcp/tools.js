import crypto from "crypto";
import { CreditAccount } from "../db/models/CreditAccount.js";
import { User } from "../db/models/User.js";
import { UIComponentCache } from "../db/models/UIComponentCache.js";

/**
 * Definiciones de tools en formato Gemini function declarations.
 * Esta es la única superficie por la que el agente toca datos y
 * dispara acciones reales — equivalente al servidor MCP del pizarrón.
 */
export const toolDefinitions = [
  {
    name: "get_credit_plans",
    description:
      "Obtiene el saldo actual de la tarjeta del usuario y calcula opciones " +
      "de reestructura (12, 18 y 24 meses) con su CAT y mensualidad. " +
      "Úsala cuando el usuario quiera pagar menos intereses, reestructurar " +
      "su deuda o entender opciones de pago de su tarjeta.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID del usuario" },
      },
      required: ["userId"],
    },
  },
  {
    name: "apply_credit_plan",
    description:
      "Aplica un plan de reestructura de crédito elegido por el usuario. " +
      "Esta es una acción real: cambia el plan de pago vigente en la cuenta.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        months: { type: "number", description: "Plazo elegido (12, 18 o 24)" },
      },
      required: ["userId", "months"],
    },
  },
];

// --- Reglas de negocio simples para calcular CAT/mensualidad por plazo ---
const PLAN_RULES = {
  12: { catDelta: -3.6, factor: 0.0921 }, // ~ cuota mensual como fracción del saldo
  18: { catDelta: -1.9, factor: 0.0663 },
  24: { catDelta: -0.0, factor: 0.0535 },
};

function hashInputs(obj) {
  return crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
}

async function withCache(userId, toolName, relevantInputs, compute) {
  const cacheKey = `${userId}:${toolName}:${hashInputs(relevantInputs)}`;
  const cached = await UIComponentCache.findOne({ cacheKey });
  if (cached) {
    return { payload: cached.payload, cacheHit: true };
  }
  const payload = await compute();
  await UIComponentCache.create({ cacheKey, userId, toolName, payload });
  return { payload, cacheHit: false };
}

/**
 * Handlers reales de cada tool. El agente nunca toca Mongo directamente,
 * siempre pasa por aquí.
 */
export const toolHandlers = {
  async get_credit_plans({ userId }) {
    const account = await CreditAccount.findOne({ userId });
    if (!account) throw new Error(`No existe cuenta de crédito para ${userId}`);

    const { payload, cacheHit } = await withCache(
      userId,
      "get_credit_plans",
      { balance: account.balance, rate: account.currentRate },
      async () => {
        const options = Object.entries(PLAN_RULES).map(([months, rule]) => {
          const cat = +(account.currentRate + rule.catDelta).toFixed(1);
          const monthlyPayment = Math.round(account.balance * rule.factor);
          return { months: Number(months), cat, monthlyPayment };
        });
        return {
          balance: account.balance,
          cardLastFour: account.cardLastFour,
          options,
        };
      }
    );

    return { ...payload, cacheHit };
  },

  async apply_credit_plan({ userId, months }) {
    const account = await CreditAccount.findOne({ userId });
    if (!account) throw new Error(`No existe cuenta de crédito para ${userId}`);

    const rule = PLAN_RULES[months];
    if (!rule) throw new Error(`Plazo inválido: ${months}`);

    const cat = +(account.currentRate + rule.catDelta).toFixed(1);
    const monthlyPayment = Math.round(account.balance * rule.factor);

    account.activePlan = { months, cat, monthlyPayment, appliedAt: new Date() };
    await account.save();

    // El movimiento se guarda para actualizar el "prompt general" del usuario
    const user = await User.findOne({ userId });
    if (user) {
      user.pushActivity({
        intent: "aplicar_plan_reestructura",
        action: "apply_credit_plan",
        summary: `Aplicó reestructura a ${months} meses (mensualidad $${monthlyPayment}, CAT ${cat}%).`,
      });
      await user.save();
    }

    return { months, cat, monthlyPayment, balance: account.balance };
  },
};

export async function callTool(name, input) {
  const handler = toolHandlers[name];
  if (!handler) throw new Error(`Tool desconocida: ${name}`);
  return handler(input);
}
