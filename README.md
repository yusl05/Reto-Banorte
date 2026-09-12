# Banorte × Tec — Crédito IA (UI Generativa)

Implementación del reto "Interfaces que la IA construye en tiempo real" para el
dominio de **Crédito**: la persona pide pagar menos intereses de su tarjeta y el
agente arma en vivo la tarjeta de reestructura (12/18/24 meses), no un muro de texto.

## Cómo mapea a la arquitectura del pizarrón

```
Usuario ──▶ Agente/LLM ──▶ MCP ──▶ DB ──▶ Cache ──┬──▶ Genera nuevo ─┐
   ▲                                              └──▶ Reutiliza ────┼──▶ A2UI ──▶ Componentes
   └──────────────────────────────────────────────────────────────────────────────┘
                         (la interacción del usuario con el componente regresa como contexto)
```

| Pieza del pizarrón | Dónde vive en el código |
|---|---|
| Agente | `backend/src/agent/agent.js` — llama al LLM con tool-use |
| MCP (datos, herramientas, acciones) | `backend/src/mcp/tools.js` |
| DB (no SQL) | MongoDB — `backend/src/db/models/*` |
| Cache (genera nuevo / reutiliza existente) | `UIComponentCache` — clave: `userId + intención` |
| A2UI | `backend/src/a2ui/components.js` — contrato JSON de UI |
| Componentes | `frontend/app.js` — registry que renderiza cada tipo de componente |
| "Prompt general" que se actualiza con últimos movimientos | `backend/src/agent/systemPrompt.js`, alimentado por `User.recentActivity` |

## No negociables cubiertos

- **LLM al centro**: `agent.js` decide qué tool llamar y qué componente devolver, no hay lógica de UI hardcodeada por intención.
- **MCP**: las tools (`get_credit_plans`, `apply_credit_plan`) son la única forma en que el LLM toca datos/acciones.
- **A2UI**: la respuesta al frontend nunca es HTML fijo, es un JSON `{ component, props }` que el frontend interpreta.
- **Cache**: antes de recalcular planes, se busca en `UIComponentCache`; si el saldo no cambió, se reutiliza.

## Flujo accionable (el que exige la rúbrica)

1. Usuario escribe: *"Quiero pagar menos intereses de mi tarjeta"*.
2. Agente interpreta intención → llama a `get_credit_plans` (MCP) → si hay cache válido lo reutiliza, si no, calcula y guarda.
3. Agente devuelve A2UI `credit_restructure_card` con 3 opciones.
4. Frontend renderiza la tarjeta (igual al mockup del PDF).
5. Usuario da clic en "Aplicar plan" → frontend manda la acción al backend.
6. Backend ejecuta `apply_credit_plan` (MCP, acción real: cambia el plan de pago en la DB), guarda el movimiento en `recentActivity`.
7. Esa interacción regresa al agente como contexto → agente devuelve A2UI de confirmación.
8. El "prompt general" del usuario se actualiza con este movimiento para la próxima intención.

## Levantar el proyecto

```bash
cp backend/.env.example backend/.env
# agrega tu ANTHROPIC_API_KEY en backend/.env
docker compose up --build
```

- Backend + Mongo quedan arriba con `docker-compose.yml`.
- Al iniciar, `scripts/seed.js` crea un usuario demo con saldo de $18,400 (el mismo número del mockup del PDF).
- Abre `frontend/index.html` en el navegador (o sírvelo con cualquier static server) — apunta a `http://localhost:3000`.

## Stack (según pizarrón)

- Node.js LTS (front y back), JavaScript en ambos lados.
- MongoDB (LTS) — no SQL.
- Docker — replicabilidad.
- Sin framework de UI pesado: A2UI se renderiza con un registry de componentes en JS puro, para que quede claro que **el equipo construye sus propios componentes** (regla 1 del reto).
