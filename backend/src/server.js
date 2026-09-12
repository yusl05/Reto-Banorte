import 'dotenv/config'; // <-- CLAVE: Carga el .env antes de hacer cualquier cosa
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { chatRouter } from './routes/chat.js';
import { actionRouter } from './routes/action.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/chat', chatRouter);
app.use('/api/action', actionRouter);

const PORT = process.env.PORT || 3000;

// Conexión real a la base de datos y arranque del servidor
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("🟢 Conectado REALMENTE a MongoDB Atlas");
    app.listen(PORT, () => {
      console.log(`[server] escuchando en :${PORT}`);
    });
  })
  .catch(err => {
    console.error("🔴 Error fatal al conectar a MongoDB:", err);
  });