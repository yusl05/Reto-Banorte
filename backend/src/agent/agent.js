import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, callTool } from "../mcp/tools.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import {
  creditRestructureCard,
  planConfirmationCard,
  textCard,
} from "../a2ui/components.js";
import { User } from "../db/models/User.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// Convierte el resultado crudo de una tool MCP en un componente A2UI
function toolResultToA2UI(toolName, result) {
  if (toolName === "get_credit_plans") return creditRestructureCard(result);
  if (toolName === "apply_credit_plan") return planConfirmationCard(result);
  return null;
}

/**
 * Punto de entrada del agente. Recibe el mensaje del usuario (o una acción
 * disparada por un componente ya renderizado) y devuelve:
 *   { reply: string, ui: <objeto A2UI o null> }
 */
export async function runAgent({ userId, message }) {
  const user = await User.findOne({ userId });
  if (!user) throw new Error(`Usuario no encontrado: ${userId}`);

  const systemPrompt = buildSystemPrompt(user);

  let messages = [{ role: "user", content: message }];
  let uiToReturn = null;
  let finalText = "";

  // Loop de tool-use: el LLM puede pedir 1+ tools antes de responder en texto
  for (let turn = 0; turn < 4; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const textBlocks = response.content.filter((b) => b.type === "text");
    finalText = textBlocks.map((b) => b.text).join(" ").trim() || finalText;

    if (toolUseBlocks.length === 0) {
      // El modelo ya terminó, no pidió más tools
      break;
    }

    // Ejecutamos cada tool que pidió el agente (vía MCP) y regresamos resultados
    messages.push({ role: "assistant", content: response.content });

    const toolResultsContent = [];
    for (const block of toolUseBlocks) {
      let result;
      try {
        result = await callTool(block.name, { userId, ...block.input });
        const ui = toolResultToA2UI(block.name, result);
        if (ui) uiToReturn = ui; // el último componente generado es el que se muestra
      } catch (err) {
        result = { error: err.message };
      }
      toolResultsContent.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResultsContent });
  }

  if (!uiToReturn && finalText) {
    uiToReturn = textCard(finalText);
  }

  return {
    reply: finalText || "Listo.",
    ui: uiToReturn,
  };
}
