import { GoogleGenAI } from "@google/genai";

export async function processUserMessage(userMessage, contextData) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `
      Eres el Liquidity Copilot de Banorte.
      Contexto actual de la conversación: ${contextData.activePromptContext}
      Datos de la cuenta del usuario: Deuda $${contextData.accountDetails.totalDebt}, Límite de Crédito $${contextData.accountDetails.creditLimit}.
      
      Debes responder SIEMPRE con un objeto JSON válido con esta estructura exacta:
      {
        "reply": "Tu mensaje de texto de respuesta para el usuario",
        "ui": null,
        "newContext": "Un breve resumen actualizado de lo que quiere el usuario",
        "currentIntent": "Ej. DEBT_RESTRUCTURE",
        "dashboardUpdates": {
          "layout": "single-focus-dashboard",
          "highlightedPlan": "12"
        }
      }
      Analiza la intención del usuario y ajusta tu respuesta y las sugerencias del dashboard basándote en sus datos financieros.
    `;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json", // Fuerza a Gemini a devolver JSON
      }
    });

    // Como pedimos JSON, parseamos el texto directamente
    return JSON.parse(response.text);

  } catch (error) {
    console.error("🔴 Error detallado en el agente de IA:", error);
    return {
      reply: "Error técnico al conectar con el modelo.",
      ui: null,
      newContext: contextData.activePromptContext
    };
  }
}