import { Router } from "express";
import { requireSession } from "../auth/session.js";
import { callTool } from "../mcp/tools.js";
import { User } from "../db/models/User.js";

const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * No hay histórico real de saldo en el modelo de Mongo (CreditAccount solo
 * guarda el saldo actual). Para que la gráfica "Evolución del saldo deudor"
 * tenga algo que mostrar, se genera un histórico de 6 meses de forma
 * determinista a partir del saldo real de hoy -- siempre termina en el
 * saldo actual exacto, los meses previos son una curva de ejemplo, no
 * datos reales.
 */
function buildBalanceHistory(currentBalance) {
  const growthFactors = [0.7, 0.76, 0.81, 0.86, 0.92, 1.0];
  const now = new Date();
  return growthFactors.map((factor, i) => {
    const monthIndex = (now.getMonth() - (growthFactors.length - 1 - i) + 12) % 12;
    return {
      label: MONTH_LABELS[monthIndex],
      balance: Math.round(currentBalance * factor),
    };
  });
}

/**
 * Endpoint de solo lectura para pintar el dashboard al cargar la página.
 * Reutiliza la misma tool MCP que usa el agente (get_credit_plans), pero
 * la llama directo -- sin pasar por el LLM -- porque aquí no hay ninguna
 * intención que interpretar, solo mostrar el estado actual de la cuenta.
 */
export function createAccountRouter() {
  const accountRouter = Router();

  accountRouter.get("/", requireSession, async (req, res) => {
    try {
      const user = await User.findOne({ userId: req.userId });
      const snapshot = await callTool("get_credit_plans", { userId: req.userId });
      res.json({
        name: user?.name || "Cliente",
        ...snapshot,
        balanceHistory: buildBalanceHistory(snapshot.balance),
      });
    } catch (err) {
      console.error("[account] error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return accountRouter;
}