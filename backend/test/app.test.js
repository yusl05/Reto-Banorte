import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";

let server;
let baseUrl;
const agentCalls = [];

before(async () => {
  const app = createApp({
    frontendOrigin: "http://frontend.test",
    agent: async (input) => {
      agentCalls.push(input);
      return { reply: "respuesta de prueba", ui: null, provider: "test" };
    },
  });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Origin: "http://frontend.test", ...(options.headers || {}) },
  });
}

test("crea una sesión demo y expone una cookie HttpOnly", async () => {
  const response = await request("/api/session/demo", { method: "POST" });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: "demo-user" });
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /banorte_session=[^;]+/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test("rechaza chat y acciones sin sesión", async () => {
  const chat = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hola" }),
  });
  const action = await request("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionId: "apply_plan", payload: { months: 12 } }),
  });

  assert.equal(chat.status, 401);
  assert.deepEqual(await chat.json(), { error: "Sesión requerida" });
  assert.equal(action.status, 401);
  assert.deepEqual(await action.json(), { error: "Sesión requerida" });
});

test("mantiene la sesión en chat y no acepta un userId del cliente", async () => {
  const sessionResponse = await request("/api/session/demo", { method: "POST" });
  const cookie = sessionResponse.headers.get("set-cookie").split(";")[0];
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ message: "hola", userId: "attacker" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(agentCalls.at(-1), { userId: "demo-user", message: "hola" });
});

test("valida mensajes y acciones antes de invocar al agente", async () => {
  const sessionResponse = await request("/api/session/demo", { method: "POST" });
  const cookie = sessionResponse.headers.get("set-cookie").split(";")[0];
  const emptyMessage = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ message: "" }),
  });
  const unknownAction = await request("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ actionId: "unknown" }),
  });

  assert.equal(emptyMessage.status, 400);
  assert.equal(unknownAction.status, 400);
});

test("permite el origen configurado y rechaza otro origen", async () => {
  const allowed = await request("/health");
  const rejected = await fetch(`${baseUrl}/health`, { headers: { Origin: "http://other.test" } });

  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://frontend.test");
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: "Origen no permitido por CORS" });
});
