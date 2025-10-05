// db.js
import { MongoClient } from 'mongodb';
const uri = process.env.MONGO_URI; // Replace with your URI
const dbName = "rag";

let client;
let db;

export async function connectToMongo() {
    if (db) return db;

    client = new MongoClient(uri, { useUnifiedTopology: true });
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
    await db.close();
}

// module.exports = {
//     connectToMongo,
//     getDB,
//     getCollection,
//     closeConn
// };
