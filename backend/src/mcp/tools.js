import crypto from "crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CreditAccount } from "../db/models/CreditAccount.js";
import { User } from "../db/models/User.js";
import { UIComponentCache } from "../db/models/UIComponentCache.js";

const PLAN_RULES = {
  12: { catDelta: -3.6, factor: 0.0921 },
  18: { catDelta: -1.9, factor: 0.0663 },
  24: { catDelta: -0.0, factor: 0.0535 },
};

let mcpClient;

function hashInputs(obj) {
  return crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
}

async function withCache(userId, toolName, relevantInputs, compute) {
  const cacheKey = `${userId}:${toolName}:${hashInputs(relevantInputs)}`;
  const cached = await UIComponentCache.findOne({ cacheKey });
  if (cached) return { payload: cached.payload, cacheHit: true };
  const payload = await compute();
  await UIComponentCache.create({ cacheKey, userId, toolName, payload });
  return { payload, cacheHit: false };
}

async function getCreditPlans({ userId }) {
  const account = await CreditAccount.findOne({ userId });
  if (!account) throw new Error(`No existe cuenta de crédito para ${userId}`);

  const { payload, cacheHit } = await withCache(
    userId,
    "get_credit_plans",
    { balance: account.balance, rate: account.currentRate, activePlan: account.activePlan?.months ?? null },
    async () => ({
      balance: account.balance,
      currentRate: account.currentRate,
      cardLastFour: account.cardLastFour,
      activePlan: account.activePlan,
      balanceHistory: account.balanceHistory || [],
      options: Object.entries(PLAN_RULES).map(([months, rule]) => ({
        months: Number(months),
        cat: +(account.currentRate + rule.catDelta).toFixed(1),
        monthlyPayment: Math.round(account.balance * rule.factor),
      })),
    })
  );
  return { ...payload, cacheHit };
}

async function applyCreditPlan({ userId, months }) {
  const account = await CreditAccount.findOne({ userId });
  if (!account) throw new Error(`No existe cuenta de crédito para ${userId}`);
  const numericMonths = Number(months);
  const rule = PLAN_RULES[numericMonths];
  if (!rule) throw new Error(`Plazo inválido: ${months}`);

  const cat = +(account.currentRate + rule.catDelta).toFixed(1);
  const monthlyPayment = Math.round(account.balance * rule.factor);
  account.activePlan = { months: numericMonths, cat, monthlyPayment, appliedAt: new Date() };
  await account.save();
  await UIComponentCache.deleteMany({ userId, toolName: "get_credit_plans" });

  const user = await User.findOne({ userId });
  if (user) {
    user.pushActivity({
      intent: "aplicar_plan_reestructura",
      action: "apply_credit_plan",
      summary: `Aplicó reestructura a ${numericMonths} meses (mensualidad $${monthlyPayment}, CAT ${cat}%).`,
    });
    await user.save();
  }
  return { months: numericMonths, cat, monthlyPayment, balance: account.balance };
}

const toolSpecs = {
  get_credit_plans: {
    description: "Obtiene opciones de reestructura de la cuenta autenticada.",
    // userId es opcional en el schema que ve el LLM a propósito: el backend
    // lo inyecta automáticamente a partir de la sesión (ver agent.js), así
    // que el modelo nunca debe pedírselo al usuario. Si fuera requerido,
    // Gemini lo trataría como un dato obligatorio que le falta y se lo
    // preguntaría al usuario en vez de llamar la tool.
    inputSchema: { userId: z.string().optional() },
    handler: getCreditPlans,
  },
  apply_credit_plan: {
    description: "Aplica un plan de reestructura de 12, 18 o 24 meses.",
    inputSchema: { userId: z.string().optional(), months: z.number() },
    handler: applyCreditPlan,
  },
};

async function startMcpServer() {
  const server = new McpServer({ name: "banorte-credit-tools", version: "1.0.0" });
  for (const [name, spec] of Object.entries(toolSpecs)) {
    server.tool(name, spec.description, spec.inputSchema, async (input) => ({
      content: [{ type: "text", text: JSON.stringify(await spec.handler(input)) }],
    }));
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "banorte-agent", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

export async function initializeMcp() {
  if (!mcpClient) mcpClient = await startMcpServer();
}

export async function getMcpTools() {
  await initializeMcp();
  const { tools } = await mcpClient.listTools();
  return tools;
}

export async function callTool(name, input) {
  await initializeMcp();
  const result = await mcpClient.callTool({ name, arguments: input });
  if (result.isError) {
    throw new Error(result.content?.[0]?.text || `Error en tool MCP: ${name}`);
  }
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error(`Respuesta MCP inválida para ${name}`);
  return JSON.parse(text);
}