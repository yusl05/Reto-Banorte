import { GoogleGenAI } from "@google/genai";
import { toolDefinitions, callTool } from "../mcp/tools.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import {
  creditRestructureCard,
  planConfirmationCard,
  textCard,
} from "../a2ui/components.js";
import { User } from "../db/models/User.js";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

  const contents = [{ role: "user", parts: [{ text: message }] }];
  let uiToReturn = null;
  let finalText = "";

  // Loop de tool-use: el LLM puede pedir 1+ tools antes de responder en texto
  for (let turn = 0; turn < 4; turn++) {
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 512,
        tools: [{ functionDeclarations: toolDefinitions }],
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) {
      throw new Error("Gemini no devolvió contenido");
    }

    const parts = modelContent.parts || [];
    const functionCallParts = parts.filter((part) => part.functionCall);
    const text = parts
      .filter((part) => part.text)
      .map((part) => part.text)
      .join(" ")
      .trim();
    finalText = text || finalText;

    if (functionCallParts.length === 0) {
      break;
    }

    contents.push(modelContent);

    const functionResponses = [];
    for (const part of functionCallParts) {
      const { name, args = {} } = part.functionCall;
      let result;
      try {
        result = await callTool(name, { userId, ...args });
        const ui = toolResultToA2UI(name, result);
        if (ui) uiToReturn = ui; // el último componente generado es el que se muestra
      } catch (err) {
        result = { error: err.message };
      }
      functionResponses.push({
        functionResponse: {
          name,
          response: result,
        },
      });
    }
    contents.push({ role: "user", parts: functionResponses });
  }

  if (!uiToReturn && finalText) {
    uiToReturn = textCard(finalText);
  }

  return {
    reply: finalText || "Listo.",
    ui: uiToReturn,
  };
}
