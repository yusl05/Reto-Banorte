import express from 'express';

export const chatRouter = express.Router();

chatRouter.post('/', (req, res) => {
  const userMessage = req.body.message || "Sin mensaje";
  console.log("✉️ El usuario escribió:", userMessage);
  
  // Esto es lo que verá la pantalla web temporalmente
  res.json({ reply: "¡Hola! El backend ya está conectado a la web y a MongoDB." });
});