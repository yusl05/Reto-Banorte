const API_BASE = "/api";
const USER_ID = "demo-user";

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
  credit_restructure_card(props) {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <p class="card__eyebrow">${props.subtitle}</p>
      <h3 class="card__title">${props.title}</h3>
      <div class="plan-list"></div>
      <p class="card__meta">${props.meta}</p>
      <button class="card__cta" disabled>Selecciona un plazo</button>
    `;

    const list = card.querySelector(".plan-list");
    const cta = card.querySelector(".card__cta");
    let selectedMonths = null;

    props.options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "plan-option" + (opt.recommended ? " plan-option--recommended" : "");
      row.innerHTML = `
        <div>
          <div class="plan-option__term">${opt.months} meses</div>
          <div class="plan-option__cat">CAT ${opt.cat}%</div>
        </div>
        <div class="plan-option__amount">$${opt.monthlyPayment.toLocaleString("es-MX")}</div>
      `;
      row.addEventListener("click", () => {
        list.querySelectorAll(".plan-option").forEach((r) => r.classList.remove("plan-option--recommended"));
        row.classList.add("plan-option--recommended");
        selectedMonths = opt.months;
        cta.disabled = false;
        cta.textContent = `Aplicar plan a ${opt.months} meses`;
      });
      list.appendChild(row);
    });

    cta.addEventListener("click", () => {
      if (!selectedMonths) return;
      cta.disabled = true;
      cta.textContent = "Aplicando…";
      sendAction("apply_plan", { months: selectedMonths });
    });

    return card;
  },

  plan_confirmation_card(props) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="confirmation">
        <div class="confirmation__check">✓</div>
        <h3 class="card__title">${props.title}</h3>
        <div class="confirmation__row"><span>Plazo</span><span>${props.months} meses</span></div>
        <div class="confirmation__row"><span>CAT</span><span>${props.cat}%</span></div>
        <div class="confirmation__row"><span>Mensualidad</span><span>$${props.monthlyPayment.toLocaleString("es-MX")}</span></div>
        <p class="confirmation__note">${props.note}</p>
      </div>
    `;
    return card;
  },

  text_card(props) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<p class="card__title" style="font-size:15px;font-family:var(--font-ui);font-weight:500;">${props.text}</p>`;
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
  const node = renderer(ui.props);
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
      body: JSON.stringify({ userId: USER_ID, message }),
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

async function sendAction(actionId, payload) {
  const typing = addTyping();
  try {
    const res = await fetch(`${API_BASE}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, actionId, payload }),
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

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  sendMessage(value);
});

// Mensaje de bienvenida
addBubble("Hola, soy tu agente de crédito Banorte. Cuéntame qué necesitas.", "agent");
