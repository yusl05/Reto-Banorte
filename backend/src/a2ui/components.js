/**
 * A2UI: la interfaz "viaja" como JSON, nunca como HTML fijo.
 * Cada componente declara:
 *  - component: el tipo (el frontend tiene un registry para renderizarlos)
 *  - props: los datos que necesita para pintarse
 *  - actions: qué eventos puede disparar de vuelta hacia el agente
 */

export function creditRestructureCard({ balance, cardLastFour, options, cacheHit }) {
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

export function textCard(text) {
  return {
    component: "text_card",
    props: { text },
    actions: [],
  };
}
