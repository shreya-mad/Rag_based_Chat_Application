import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { closeConn, getCollection } from "../db.js";

// ===============================
// ✅ Load .env from backend root
// ===============================

// Required because seed.js is inside /seed folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, "../.env") });

// ===============================
// ✅ Gemini setup (API key from .env)
// ===============================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embeddingModel = genAI.getGenerativeModel({model: "models/gemini-embedding-001",});
// const embeddingModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

// ===============================
// ✅ Helper function
// ===============================
function flattenInsuranceRecord(record) {
  const {
    policyNumber,
    name,
    age,
    insuranceType,
    plan,
    premium,
    coverage,
    startDate,
    endDate,
    claims = [],
  } = record;

  const claimText =
    claims.length > 0
      ? claims
          .map(
            (c, i) =>
              `Claim ${i + 1}: ID ${c.claimId}, Date ${c.date}, Amount ₹${c.amount}, Reason: ${c.reason}, Status: ${c.status}`
          )
          .join("; ")
      : "No claim history";

  return `
Policy Number: ${policyNumber}
Customer Name: ${name}, Age: ${age}
Insurance Type: ${insuranceType}
Plan: ${plan}
Premium: ₹${premium}, Coverage: ₹${coverage}
Policy Period: ${startDate} to ${endDate}
Claims: ${claimText}
`;
}

// ===============================
// ✅ Generate & Store Embeddings
// ===============================
async function generateAndStoreEmbeddings() {
  try {
    // ===============================
    // 1️⃣ Read insurance data safely
    // ===============================
    const dataFilePath = path.join(
      __dirname,
      "insurance_data.json"
    );

    const fileData = fs.readFileSync(dataFilePath, "utf-8");
    const insuranceArray = JSON.parse(fileData);

    const documents = [];

    // ===============================
    // 2️⃣ Generate Gemini embeddings
    // ===============================
    for (const record of insuranceArray) {
      const textChunk = flattenInsuranceRecord(record);

      const result = await embeddingModel.embedContent(textChunk);
      const embedding = result.embedding.values;

      documents.push({
        text: textChunk.trim(),
        embedding,
        policyNumber: record.policyNumber,
        customerName: record.name,
        insuranceType: record.insuranceType,
      });

      console.log(`✅ Gemini embedding generated for ${record.name}`);
    }

    // ===============================
    // 3️⃣ Store in MongoDB
    // ===============================
    const collection = await getCollection("insurance_embeddings");

    if (documents.length > 0) {
      await collection.insertMany(documents);
      console.log(
        `🎯 Inserted ${documents.length} embeddings into MongoDB`
      );
    }

    await closeConn();
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// ===============================
generateAndStoreEmbeddings();
