import 'dotenv/config';
import mongoose from 'mongoose';
import { User, AgentState } from './src/db/models/schema.js';
async function seedDatabase() {
  try {
    // Conexión a MongoDB Atlas usando tu variable de entorno
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Conectado a MongoDB Atlas. Inyectando datos de prueba...");

    // Limpiar colecciones previas para evitar duplicados en las pruebas
    await User.deleteMany({});
    await AgentState.deleteMany({});

    // 1. Crear el perfil de Ana García Pérez
    const ana = new User({
      name: "Ana García Pérez",
      email: "ana.garcia@example.com",
      accountDetails: {
        creditCardNumber: "•••• •••• •••• 4821",
        totalDebt: 18400.00,
        creditLimit: 50000.00,
        bureauScore: 724
      },
      createdAt: new Date("2026-09-01T00:00:00Z")
    });
    
    await ana.save();
    console.log("✅ Usuario creado exitosamente con ID:", ana._id);

    // 2. Crear el estado de contexto para el agente de IA
    const agentState = new AgentState({
      userId: ana._id,
      activePromptContext: "El usuario mostró preocupación por los intereses acumulados y está evaluando opciones de reestructuración a 12 o 18 meses.",
      currentIntent: "DEBT_RESTRUCTURE_INQUIRY",
      activeLayoutPreset: "single-focus-dashboard",
      updatedAt: new Date("2026-09-12T13:30:00Z")
    });

    await agentState.save();
    console.log("✅ Contexto del agente inicializado para Ana.");

    console.log("¡Base de datos lista! Cierra este proceso y arranca el servidor.");
    process.exit(0);
  } catch (error) {
    console.error("🔴 Error inyectando datos:", error);
    process.exit(1);
  }
}

seedDatabase();