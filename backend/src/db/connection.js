import { MongoClient } from 'mongodb';

// El nombre de esta variable debe coincidir exactamente con el de tu archivo .env
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri);

let dbInstance = null;

export async function connectDB() {
  try {
    if (!dbInstance) {
      await client.connect();
      console.log("🟢 Conectado exitosamente a MongoDB Atlas (Nube)");
      dbInstance = client.db(); 
    }
    return dbInstance;
  } catch (error) {
    console.error("🔴 Error conectando a MongoDB Atlas:", error);
    process.exit(1);
  }
}