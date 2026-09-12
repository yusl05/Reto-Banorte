import express from 'express';

export const actionRouter = express.Router();

actionRouter.post('/', (req, res) => {
  res.json({ success: true, action: "Acción recibida" });
});