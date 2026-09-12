import mongoose from "mongoose";

/**
 * Cachea el resultado de una tool de MCP para no recalcular/regenerar
 * la misma UI si nada relevante cambió (balance, tasa, plan activo).
 *
 * cacheKey = `${userId}:${toolName}:${hash de los inputs relevantes}`
 */
const uiComponentCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, unique: true, required: true },
  userId: { type: String, required: true, index: true },
  toolName: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true }, // el resultado crudo de la tool
  createdAt: { type: Date, default: Date.now, expires: 60 * 30 }, // expira en 30 min
});

export const UIComponentCache = mongoose.model(
  "UIComponentCache",
  uiComponentCacheSchema
);
