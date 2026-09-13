/**
 * A2UI: la interfaz "viaja" como JSON, nunca como HTML fijo.
 * Cada componente declara:
 *  - component: el tipo (el frontend tiene un registry para renderizarlos)
 *  - props: los datos que necesita para pintarse
 *  - actions: qué eventos puede disparar de vuelta hacia el agente
 */

export function creditRestructureCard({ balance, cardLastFour, options, cacheHit, activePlan }) {
  return {
    component: "credit_restructure_card",
    props: {
      title: `Reestructura tu saldo de $${balance.toLocaleString("es-MX")}`,
      subtitle: `Tarjeta terminación ${cardLastFour}`,
      options: options.map((o) => ({
        months: o.months,
        cat: o.cat,
        monthlyPayment: o.monthlyPayment,
        recommended: o.months === 12,
      })),
      activePlan: activePlan || null,
      meta: cacheHit ? "Datos reutilizados de tu última consulta" : "Cálculo actualizado ahora",
    },
    actions: [
      {
        id: "apply_plan",
        label: "Aplicar plan",
        // el frontend debe mandar de vuelta { actionId: 'apply_plan', months }
        requires: ["months"],
      },
    ],
  };
}

export function planConfirmationCard({ months, cat, monthlyPayment }) {
  return {
    component: "plan_confirmation_card",
    props: {
      title: "Tu nuevo plan quedó activo",
      months,
      cat,
      monthlyPayment,
      note: "Ya puedes ver tu nueva mensualidad reflejada en tu próximo estado de cuenta.",
    },
    actions: [],
  };
}

export function validateA2UI(ui) {
  if (!ui || typeof ui !== "object" || typeof ui.component !== "string" || !ui.props) {
    throw new Error("Componente A2UI inválido");
  }
  const allowed = new Set(["credit_restructure_card", "plan_confirmation_card", "text_card"]);
  if (!allowed.has(ui.component)) throw new Error(`Componente A2UI desconocido: ${ui.component}`);
  if (!Array.isArray(ui.actions || []) || ui.actions.some(
    (action) => !action || typeof action.id !== "string" || typeof action.label !== "string"
  )) {
    throw new Error("Acciones A2UI inválidas");
  }
  return ui;
}

export function textCard(text) {
  return {
    component: "text_card",
    props: { text },
    actions: [],
  };
}
