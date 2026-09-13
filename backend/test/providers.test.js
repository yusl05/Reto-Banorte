import assert from "node:assert/strict";
import { test } from "node:test";
import { getProviders } from "../src/agent/providers.js";

test("no intenta autenticar proveedores sin API key", () => {
  const keys = [
    "GEMINI_API_KEY",
    "GROK_API_KEY",
    "HUGGINGFACE_API_KEY",
    "OPENROUTER_API_KEY",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    keys.forEach((key) => delete process.env[key]);
    assert.deepEqual(getProviders(), []);
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});
