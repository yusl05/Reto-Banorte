import { callTool, getMcpTools } from "../mcp/tools.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { getProviders, ProviderError } from "./providers.js";
import {
  creditRestructureCard,
  planConfirmationCard,
  textCard,
  validateA2UI,
} from "../a2ui/components.js";
import { User } from "../db/models/User.js";

function toolResultToA2UI(toolName, result) {
  if (toolName === "get_credit_plans") return creditRestructureCard(result);
  if (toolName === "apply_credit_plan") return planConfirmationCard(result);
  return null;
}

function shouldFallback(error) {
  return error instanceof ProviderError && error.retryable;
}

async function runWithProvider(provider, { userId, message, systemPrompt, tools }) {
  const messages = [{ role: "user", content: message }];
  let uiToReturn = null;
  let finalText = "";
  let mutationExecuted = false;

  for (let turn = 0; turn < 4; turn += 1) {
    let response;
    try {
      response = await provider.complete({ systemPrompt, messages, tools });
    } catch (error) {
      error.mutationExecuted = mutationExecuted;
      throw error;
    }
    finalText = response.text || finalText;
    if (!response.toolCalls.length) break;

    messages.push({
      role: "assistant",
      content: response.text || "",
      toolCalls: response.toolCalls,
      providerMessage: response.assistantMessage,
    });

    for (const call of response.toolCalls) {
      const { userId: _modelUserId, ...modelInput } = call.input || {};
      let result;
      try {
        result = await callTool(call.name, { ...modelInput, userId });
        if (call.name === "apply_credit_plan") mutationExecuted = true;
        const ui = toolResultToA2UI(call.name, result);
        if (ui) uiToReturn = validateA2UI(ui);
      } catch (error) {
        result = { error: error.message };
      }
      messages.push({
        role: "tool",
        name: call.name,
        toolCallId: call.id,
        content: result,
      });
    }
  }

  if (!uiToReturn && finalText) uiToReturn = validateA2UI(textCard(finalText));
  return { reply: finalText || "Listo.", ui: uiToReturn, mutationExecuted };
}

export async function runAgent({ userId, message, allowMutation = false }) {
  const user = await User.findOne({ userId });
  if (!user) throw new Error(`Usuario no encontrado: ${userId}`);

  const providers = getProviders();
  if (!providers.length) throw new Error("No hay proveedores LLM configurados");

  // apply_credit_plan mueve dinero de verdad -- solo se le da al modelo cuando
  // la petición viene de un clic real en la tarjeta (/api/action), nunca de
  // texto libre en el chat. Así, aunque el modelo malinterprete una frase
  // ambigua, no tiene forma de ejecutar la mutación sin que el usuario haya
  // confirmado explícitamente en la interfaz.
  const allTools = await getMcpTools();
  const tools = allowMutation ? allTools : allTools.filter((tool) => tool.name !== "apply_credit_plan");

  const systemPrompt = buildSystemPrompt(user);
  const failures = [];

  for (const provider of providers) {
    try {
      const result = await runWithProvider(provider, { userId, message, systemPrompt, tools });
      return { ...result, provider: provider.name };
    } catch (error) {
      failures.push(error.message);
      if (!shouldFallback(error) || error.mutationExecuted) throw error;
    }
  }
  throw new Error(`Ningún proveedor LLM pudo responder: ${failures.join("; ")}`);
}