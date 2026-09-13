const API_BASE = "/api";

const thread = document.getElementById("thread");
const composer = document.getElementById("composer");
const input = document.getElementById("composer-input");
const statementBody = document.getElementById("statement-body");

const PLAN_LABELS = { 12: "Reestructura 12 meses", 18: "Reestructura 18 meses", 24: "Reestructura 24 meses" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function money(n) {
  return `$${Number(n).toLocaleString("es-MX")}`;
}

/**
 * Línea de evolución del saldo — SVG puro, sin librerías, coherente con
 * el resto de "componentes propios" del proyecto. Recibe [{label, balance}].
 */
function renderBalanceChart(history) {
  if (!history || history.length < 2) return null;

  const width = 560;
  const height = 160;
  const padding = 24;
  const values = history.map((h) => h.balance);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((h.balance - min) / range) * (height - padding * 2);
    return { x, y, label: h.label, balance: h.balance };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "balance-chart__svg");
  svg.setAttribute("preserveAspectRatio", "none");

  const area = document.createElementNS(svgNS, "path");
  area.setAttribute("d", areaPath);
  area.setAttribute("class", "balance-chart__area");
  svg.appendChild(area);

  const line = document.createElementNS(svgNS, "path");
  line.setAttribute("d", linePath);
  line.setAttribute("class", "balance-chart__line");
  svg.appendChild(line);

  points.forEach((p, i) => {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", p.x.toFixed(1));
    dot.setAttribute("cy", p.y.toFixed(1));
    dot.setAttribute("r", i === points.length - 1 ? "4.5" : "3");
    dot.setAttribute("class", i === points.length - 1 ? "balance-chart__dot balance-chart__dot--last" : "balance-chart__dot");
    svg.appendChild(dot);
  });

  const wrap = el("div", "balance-chart");
  wrap.appendChild(svg);

  const labels = el("div", "balance-chart__labels");
  history.forEach((h) => labels.appendChild(el("span", "", h.label)));
  wrap.appendChild(labels);

  return wrap;
}

/**
 * Comparativa de intereses totales: cuánto pagarías en intereses sin
 * reestructurar (a tu tasa actual, en un año) vs. el total de intereses
 * de cada plan a lo largo de su plazo completo.
 */
function renderInterestSavings(account) {
  const currentInterest = Math.round(account.balance * (account.currentRate / 100));
  const bars = [
    { label: "Plan actual", value: currentInterest, current: true },
    ...(account.options || []).map((opt) => ({
      label: `${opt.months} meses`,
      value: Math.max(0, Math.round(opt.monthlyPayment * opt.months - account.balance)),
      recommended: opt.recommended,
    })),
  ];
  const max = Math.max(...bars.map((b) => b.value), 1);

  const wrap = el("div", "interest-savings");
  bars.forEach((bar) => {
    const row = el("div", "interest-savings__row");
    const top = el("div", "interest-savings__top");
    top.append(el("span", "", bar.label), el("span", "interest-savings__amount", money(bar.value)));
    row.appendChild(top);
    const track = el("div", "interest-savings__track");
    const fill = el("div", `interest-savings__fill${bar.current ? " interest-savings__fill--current" : ""}${bar.recommended ? " interest-savings__fill--best" : ""}`);
    fill.dataset.targetWidth = `${(bar.value / max) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);
    wrap.appendChild(row);
  });
  return wrap;
}

function renderStatement(account) {
  statementBody.innerHTML = "";

  const card = el("div", "credit-card");
  const top = el("div", "credit-card__top");
  top.append(el("span", "credit-card__brand", "Banorte"), el("span", "credit-card__tier", "ORO · CRÉDITO"));
  card.append(top, el("div", "credit-card__number", `•••• •••• •••• ${account.cardLastFour}`));
  const bottom = el("div", "credit-card__bottom");
  bottom.append(el("span", "credit-card__holder", account.name || "Titular"), el("span", "", "Cuenta activa"));
  card.append(bottom);
  statementBody.appendChild(card);

  const summary = el("div", "summary-row");
  const balanceItem = el("div", "summary-item");
  balanceItem.append(el("p", "summary-item__label", "Saldo deudor actual"));
  const balanceValue = el("p", "summary-item__value", money(account.balance));
  const rateTag = el("span", "summary-item__value--tag", `Tasa ${account.currentRate ?? "—"}%`);
  balanceValue.appendChild(rateTag);
  balanceItem.appendChild(balanceValue);
  summary.appendChild(balanceItem);
  statementBody.appendChild(summary);

  statementBody.appendChild(
    el("p", "section-subtitle", account.activePlan
      ? `Plan activo: ${account.activePlan.months} meses · mensualidad ${money(account.activePlan.monthlyPayment)}`
      : "Sin plazo fijo · financiación revolvente continua")
  );

  statementBody.appendChild(el("h2", "section-title", "Comparativa de intereses por plazo"));
  statementBody.appendChild(el("p", "section-subtitle", "Ahorro potencial según el plazo elegido"));

  const compare = el("div", "compare");
  const rates = (account.options || []).map((o) => o.cat);
  const maxCat = Math.max(account.currentRate || 0, ...rates, 1);

  const currentRow = el("div", "compare-row compare-row--current");
  const currentTop = el("div", "compare-row__top");
  currentTop.append(el("span", "compare-row__label", "Plan actual"), el("span", "compare-row__amount", `CAT ${account.currentRate}%`));
  currentRow.appendChild(currentTop);
  const currentTrack = el("div", "compare-row__track");
  const currentFill = el("div", "compare-row__fill");
  currentFill.dataset.targetWidth = `${(account.currentRate / maxCat) * 100}%`;
  currentTrack.appendChild(currentFill);
  currentRow.appendChild(currentTrack);
  currentRow.appendChild(el("div", "compare-row__meta", "Sin ahorro"));
  compare.appendChild(currentRow);

  (account.options || []).forEach((opt) => {
    const row = el("div", `compare-row${opt.recommended ? " compare-row--best" : ""}`);
    const top2 = el("div", "compare-row__top");
    const label = el("span", "compare-row__label", `${opt.months} meses`);
    if (opt.recommended) label.appendChild(el("span", "compare-row__recommended", "Recomendado"));
    top2.append(label, el("span", "compare-row__amount", `CAT ${opt.cat}%`));
    row.appendChild(top2);
    const track = el("div", "compare-row__track");
    const fill = el("div", "compare-row__fill");
    fill.dataset.targetWidth = `${(opt.cat / maxCat) * 100}%`;
    track.appendChild(fill);
    row.appendChild(track);
    const meta = el("div", "compare-row__meta");
    meta.append(
      el("span", "", `Mensualidad ${money(opt.monthlyPayment)}`),
      el("span", "compare-row__save", account.currentRate > opt.cat ? `Ahorras en CAT vs. tu tasa actual` : "")
    );
    row.appendChild(meta);
    compare.appendChild(row);
  });
  statementBody.appendChild(compare);

  const balanceChart = renderBalanceChart(account.balanceHistory);
  if (balanceChart) {
    statementBody.appendChild(el("h2", "section-title", "Evolución del saldo deudor"));
    statementBody.appendChild(el("p", "section-subtitle", "Histórico de comportamiento en los últimos 6 meses"));
    statementBody.appendChild(balanceChart);
  }

  statementBody.appendChild(el("h2", "section-title", "Ahorro potencial en intereses"));
  statementBody.appendChild(el("p", "section-subtitle", "Intereses totales estimados, plan actual vs. reestructura"));
  statementBody.appendChild(renderInterestSavings(account));

  requestAnimationFrame(() => {
    statementBody.querySelectorAll("[data-target-width]").forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
  });

  const cta = el("button", "statement-cta");
  cta.append(el("span", "", "Pedir reestructura al agente"), el("span", "", "→"));
  cta.addEventListener("click", () => {
    document.querySelector(".copilot")?.scrollIntoView({ behavior: "smooth", block: "start" });
    input.focus();
    sendMessage("Quiero pagar menos intereses de mi tarjeta");
  });
  statementBody.appendChild(cta);
}

async function loadStatement() {
  try {
    const res = await fetch(`${API_BASE}/account`, { credentials: "include" });
    if (!res.ok) throw new Error("No se pudo cargar el estado de cuenta");
    const account = await res.json();
    renderStatement(account);
  } catch (err) {
    statementBody.innerHTML = "";
    statementBody.appendChild(el("p", "statement__error", `No se pudo cargar tu estado de crédito: ${err.message}`));
  }
}

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

  clarification_card(props) {
    const card = document.createElement("div");
    card.className = "card clarification";
    const icon = document.createElement("div");
    icon.className = "clarification__icon";
    icon.textContent = "?";
    const text = document.createElement("p");
    text.className = "clarification__text";
    text.textContent = props.text;
    card.append(icon, text);
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
    if (data.ui && !["text_card", "clarification_card"].includes(data.ui.component)) {
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
    if (data.ui && !["text_card", "clarification_card"].includes(data.ui.component)) {
    renderUI(data.ui);
  }
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
  .then(() => {
    addBubble("Hola, soy tu agente de crédito Banorte. Cuéntame qué necesitas.", "agent");
    loadStatement();
  })
  .catch((err) => addBubble(`No pude iniciar la sesión: ${err.message}`, "agent"));