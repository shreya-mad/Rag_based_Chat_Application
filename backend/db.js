import dotenv from "dotenv";
import { MongoClient } from 'mongodb';

dotenv.config();
const dbName = "rag";
let client;
let db;

export async function connectToMongo() {
    if (db) return db;
    const uri = process.env.MONGO_URI; // Read at runtime after dotenv
    if (!uri) throw new Error("MONGO_URI environment variable is not set");
    // client = new MongoClient(uri, { useUnifiedTopology: true });
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    console.log("✅ MongoDB connected");
    return db;
}

async function getDB() {
    if (!db) {
        await connectToMongo();
    }
    return db;
}

export async function getCollection(collectionName) {
    const database = await getDB();
    return database.collection(collectionName);
}

export async function closeConn() {
    if (client) await client.close();
}

