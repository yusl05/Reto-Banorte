const API_BASE = "/api";

const thread = document.getElementById("thread");
const composer = document.getElementById("composer");
const input = document.getElementById("composer-input");

function addBubble(text, who) {
  const el = document.createElement("div");
  el.className = `bubble bubble--${who}`;
  el.textContent = text;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

function addTyping() {
  const el = document.createElement("div");
  el.className = "typing";
  el.textContent = "El agente está pensando…";
  el.id = "typing-indicator";
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

function removeTyping() {
  document.getElementById("typing-indicator")?.remove();
}

/**
 * Registry de componentes A2UI. Cada key es un "component" que puede
 * mandar el backend; el valor es la función que lo pinta en el DOM.
 * Este registry ES la "biblioteca de componentes propia" que pide el reto.
 */
const componentRegistry = {
  credit_restructure_card(props, actions = []) {
    const card = document.createElement("div");
    card.className = "card";

    const eyebrow = document.createElement("p");
    eyebrow.className = "card__eyebrow";
    eyebrow.textContent = props.subtitle;
    const title = document.createElement("h3");
    title.className = "card__title";
    title.textContent = props.title;
    const list = document.createElement("div");
    list.className = "plan-list";
    const meta = document.createElement("p");
    meta.className = "card__meta";
    meta.textContent = props.meta;
    const cta = document.createElement("button");
    cta.className = "card__cta";
    cta.disabled = true;
    const applyAction = actions.find((action) => action.id === "apply_plan");
    cta.textContent = applyAction?.label || "Selecciona un plazo";
    card.append(eyebrow, title, list, meta, cta);

    let selectedMonths = null;

    props.options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "plan-option" + (opt.recommended ? " plan-option--recommended" : "");
      const detail = document.createElement("div");
      const term = document.createElement("div");
      term.className = "plan-option__term";
      term.textContent = `${opt.months} meses`;
      const cat = document.createElement("div");
      cat.className = "plan-option__cat";
      cat.textContent = `CAT ${opt.cat}%`;
      detail.append(term, cat);
      const amount = document.createElement("div");
      amount.className = "plan-option__amount";
      amount.textContent = `$${opt.monthlyPayment.toLocaleString("es-MX")}`;
      row.append(detail, amount);
      row.addEventListener("click", () => {
        list.querySelectorAll(".plan-option").forEach((r) => r.classList.remove("plan-option--recommended"));
        row.classList.add("plan-option--recommended");
        selectedMonths = opt.months;
        cta.disabled = false;
        cta.textContent = `${applyAction?.label || "Aplicar plan"} a ${opt.months} meses`;
      });
      list.appendChild(row);
    });

    cta.addEventListener("click", () => {
      if (!selectedMonths) return;
      cta.disabled = true;
      cta.textContent = "Aplicando…";
      if (applyAction) sendAction(applyAction.id, { months: selectedMonths });
    });

    return card;
  },

  plan_confirmation_card(props) {
    const card = document.createElement("div");
    card.className = "card";
    const confirmation = document.createElement("div");
    confirmation.className = "confirmation";
    const check = document.createElement("div");
    check.className = "confirmation__check";
    check.textContent = "✓";
    const title = document.createElement("h3");
    title.className = "card__title";
    title.textContent = props.title;
    confirmation.append(check, title);
    [["Plazo", `${props.months} meses`], ["CAT", `${props.cat}%`],
      ["Mensualidad", `$${props.monthlyPayment.toLocaleString("es-MX")}`]].forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "confirmation__row";
      const left = document.createElement("span");
      left.textContent = label;
      const right = document.createElement("span");
      right.textContent = value;
      row.append(left, right);
      confirmation.appendChild(row);
    });
    const note = document.createElement("p");
    note.className = "confirmation__note";
    note.textContent = props.note;
    confirmation.appendChild(note);
    card.appendChild(confirmation);
    return card;
  },

  text_card(props) {
    const card = document.createElement("div");
    card.className = "card";
    const text = document.createElement("p");
    text.className = "card__title";
    text.style.cssText = "font-size:15px;font-family:var(--font-ui);font-weight:500;";
    text.textContent = props.text;
    card.appendChild(text);
    return card;
  },
};

function renderUI(ui) {
  if (!ui) return;
  const renderer = componentRegistry[ui.component];
  if (!renderer) {
    console.warn("Componente A2UI desconocido:", ui.component);
    return;
  }
  const node = renderer(ui.props, ui.actions);
  thread.appendChild(node);
  thread.scrollTop = thread.scrollHeight;
}

async function sendMessage(message) {
  addBubble(message, "user");
  const typing = addTyping();
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    removeTyping();
    if (data.error) {
      addBubble(`Error: ${data.error}`, "agent");
      return;
    }
    addBubble(data.reply, "agent");
    if (data.ui && data.ui.component !== "text_card") {
      renderUI(data.ui);
    }
  } catch (err) {
    removeTyping();
    addBubble(`No pude conectar con el agente: ${err.message}`, "agent");
  }
}

async function startSession() {
  const res = await fetch(`${API_BASE}/session/demo`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo iniciar la sesión demo");
}

async function sendAction(actionId, payload) {
  const typing = addTyping();
  try {
    const res = await fetch(`${API_BASE}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ actionId, payload }),
    });
    const data = await res.json();
    removeTyping();
    if (data.error) {
      addBubble(`Error: ${data.error}`, "agent");
      return;
    }

    addBubble(data.reply, "agent");
    renderUI(data.ui);
  } catch (err) {
    removeTyping();
    addBubble(`No pude conectar con el agente: ${err.message}`, "agent");
  }
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  sendMessage(value);
});

startSession()
  .then(() => addBubble("Hola, soy tu agente de crédito Banorte. Cuéntame qué necesitas.", "agent"))
  .catch((err) => addBubble(`No pude iniciar la sesión: ${err.message}`, "agent"));
