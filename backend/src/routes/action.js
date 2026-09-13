import { Router } from "express";
import { runAgent } from "../agent/agent.js";
import { requireSession } from "../auth/session.js";

/**
 * Este endpoint es la clave del ciclo cerrado del diagrama:
 * "la interacción regresa al agente como contexto". No ejecutamos la
 * acción directamente aquí — la traducimos a un mensaje natural y se la
 * mandamos de vuelta al agente, que decide llamar a la tool de MCP
 * correspondiente (apply_credit_plan).
 */
export function createActionRouter(agent = runAgent) {
  const actionRouter = Router();

  actionRouter.post("/", requireSession, async (req, res) => {
    const { actionId, payload } = req.body;
    if (!actionId) {
      return res.status(400).json({ error: "actionId es requerido" });
    }

    const actionToMessage = {
      apply_plan: (p) =>
        `El usuario eligió aplicar el plan de reestructura a ${p.months} meses. Aplícalo.`,
    };

    const buildMessage = actionToMessage[actionId];
    if (!buildMessage) {
      return res.status(400).json({ error: `Acción desconocida: ${actionId}` });
    }

    try {
      const result = await agent({
        userId: req.userId,
        message: buildMessage(payload || {}),
        allowMutation: true,
      });
      res.json(result);
    } catch (err) {
      console.error("[action] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return actionRouter;
}