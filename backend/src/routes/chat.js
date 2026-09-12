import express from 'express';
import { processUserMessage } from '../agent/agent.js';
import { User, AgentState } from '../db/models/schema.js';// Ruta correcta a tu esquema

export const chatRouter = express.Router();

chatRouter.post('/', async (req, res) => {
  const { userId, message } = req.body; 
  console.log("✉️ Mensaje recibido del usuario:", message);

  try {
    // 1. Obtener usuario y su estado de la BD
    const user = await User.findById(userId);
    let state = await AgentState.findOne({ userId });

    if (!user || !state) {
      return res.json({ reply: "No se encontró el perfil en la base de datos.", ui: null });
    }

    // 2. Llamar a Gemini enviando el contexto financiero e historial
    const agentResponse = await processUserMessage(message, {
      activePromptContext: state.activePromptContext,
      accountDetails: user.accountDetails
    });

    // 3. Actualizar la BD con la nueva interpretación de Gemini
    state.activePromptContext = agentResponse.newContext || state.activePromptContext;
    state.currentIntent = agentResponse.currentIntent || state.currentIntent;
    state.updatedAt = new Date();
    await state.save();

    // 4. Enviar respuesta integral al frontend
    res.json({
      reply: agentResponse.reply,
      ui: agentResponse.ui,
      dashboardUpdates: agentResponse.dashboardUpdates
    });

  } catch (error) {
    console.error("🔴 Error en la ruta de chat:", error);
    res.json({ reply: "Ocurrió un error al procesar tu solicitud.", ui: null });
  }
});