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
| Agente | `backend/src/agent/agent.js` — orquesta proveedores LLM con tool-use |
| Proveedores LLM | `backend/src/agent/providers.js` — Gemini, Grok, HuggingFace y OpenRouter |
| MCP (datos, herramientas, acciones) | `backend/src/mcp/tools.js` — servidor y cliente MCP locales mediante SDK |
| DB (no SQL) | MongoDB — `backend/src/db/models/*` |
| Cache (genera nuevo / reutiliza existente) | `UIComponentCache` — clave: `userId + intención` |
| A2UI | `backend/src/a2ui/components.js` — contrato JSON de UI |
| Componentes | `frontend/app.js` — registry que renderiza cada tipo de componente |
| "Prompt general" que se actualiza con últimos movimientos | `backend/src/agent/systemPrompt.js`, alimentado por `User.recentActivity` |

## No negociables cubiertos

- **LLM al centro**: `agent.js` decide qué tool llamar y qué componente devolver, con prioridad Gemini → Grok → HuggingFace → OpenRouter.
- **MCP**: el agente descubre y llama `get_credit_plans`/`apply_credit_plan` a través de un servidor MCP local real (SDK + transporte in-memory); ningún prompt toca Mongo directamente.
- **A2UI**: la respuesta al frontend nunca es HTML fijo, es un JSON `{ component, props }` que el frontend interpreta.
- **Cache**: antes de recalcular planes, se busca en `UIComponentCache`; se reutiliza si el estado de la cuenta no cambió y se invalida tras aplicar un plan.

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
# agrega al menos GEMINI_API_KEY en backend/.env
docker compose up --build
```

- Backend + Mongo quedan arriba con `docker-compose.yml`; Mongo sólo es accesible dentro de la red de Docker.
- Al iniciar, `scripts/seed.js` crea o conserva de forma idempotente un usuario demo con saldo de $18,400 (el mismo número del mockup del PDF).
- Abre la aplicación en `http://localhost:8080` (o sírvela con un servidor
  estático, nunca con `file://`) — el frontend usa el proxy `/api/` de Nginx.
  Si usas otro origen, agrégalo a `FRONTEND_ORIGIN` y conserva
  `credentials: "include"` para que la cookie de sesión viaje en las
  peticiones.
- El frontend solicita una sesión demo mediante cookie HttpOnly antes de enviar chat o acciones. Si usas otro static server, define `FRONTEND_ORIGIN`.

## Seguridad y configuración

Nunca guardes `backend/.env` en Git. Usa `backend/.env.example` como plantilla y rota cualquier secreto que haya aparecido en el historial Git antes de desplegar. El backend no registra la URI completa de MongoDB y el cliente nunca envía un `userId`: la cuenta se deriva de la sesión.

## Flujo técnico

```text
Frontend
  → cookie de sesión demo
  → /api/chat
  → orquestador LLM (Gemini → Grok → HuggingFace → OpenRouter)
  → cliente MCP local
  → servidor MCP
  → MongoDB / UIComponentCache
  → objeto A2UI validado
  → registry seguro de componentes
```

El transporte MCP in-memory mantiene el servidor y cliente separados por protocolo dentro del proceso del backend, lo que permite probar discovery y llamadas MCP sin acoplar el agente a Mongoose. A2UI viaja como JSON validado; el frontend usa nodos DOM y `textContent`, no HTML generado por el modelo.

## Orquestación y fallback de LLM

El agente no depende de un proveedor único. `backend/src/agent/providers.js`
normaliza Gemini mediante su API nativa y Grok, HuggingFace y OpenRouter mediante
el contrato compatible con OpenAI. Sólo se habilitan los proveedores que tengan
API key configurada. Si el proveedor actual tiene timeout, error HTTP/API,
cuota agotada o entrega una respuesta inválida, el orquestador prueba el
siguiente en el orden definido.

Los errores de negocio de MCP no se ocultan cambiando de modelo. La identidad
del usuario se conserva en el backend y nunca se acepta la identidad propuesta
por el LLM. Si una acción mutante (`apply_credit_plan`) ya se ejecutó, no se
hace fallback posterior que pudiera duplicarla. HuggingFace debe entregar
tool-calling compatible; si no puede producir una llamada válida, se considera
respuesta inválida y se continúa con OpenRouter.

Variables principales:

| Proveedor | API key | Modelo | Endpoint |
|---|---|---|---|
| Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` | `GEMINI_ENDPOINT` |
| Grok | `GROK_API_KEY` | `GROK_MODEL` | `GROK_ENDPOINT` |
| HuggingFace | `HUGGINGFACE_API_KEY` | `HUGGINGFACE_MODEL` | `HUGGINGFACE_ENDPOINT` |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` | `OPENROUTER_ENDPOINT` |

`LLM_TIMEOUT_MS` controla el timeout común. Las API keys son opcionales, pero
debe existir al menos un proveedor configurado para procesar chat.

## Stack (según pizarrón)

- Node.js LTS (front y back), JavaScript en ambos lados.
- MongoDB (LTS) — no SQL.
- Docker — replicabilidad.
- Sin framework de UI pesado: A2UI se renderiza con un registry de componentes en JS puro, para que quede claro que **el equipo construye sus propios componentes** (regla 1 del reto).
