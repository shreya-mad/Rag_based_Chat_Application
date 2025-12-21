import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCollection } from "./db.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ===============================
// ✅ Gemini setup
// ===============================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ USE YOUR MODEL NAME AS-IS
const embeddingModel = genAI.getGenerativeModel({
  model: "models/gemini-embedding-001",
});

const textModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

// ===============================
// ✅ Vector Search Pipeline
// ===============================
function buildAggragationPipeline(queryEmbedding) {
  return [
    {
      $vectorSearch: {
        index: "vector_index_rag",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 10,
        limit: 3,
      },
    },
    {
      $project: {
        text: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];
}

// ===============================
// ✅ Generate embeddings
// ===============================
async function getEmbeddings(query) {
  const resp = await embeddingModel.embedContent(query);
  return resp.embedding.values;
}

// ===============================
// ✅ Gemini Answer Generation (FIXED FORMAT)
// ===============================
async function getAnswerFromLLM(query, context) {
  const prompt = `
You are a helpful assistant.
Answer ONLY using the context below.

Context:
${context}

Question:
${query}
`;

  const result = await textModel.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  return result.response.text();
}

// ===============================
// ✅ RAG Endpoint
// ===============================
app.post("/ask", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    // 1️⃣ Generate query embedding
    const queryEmbedding = await getEmbeddings(query);

    // 2️⃣ Vector search
    const collection = await getCollection("insurance_embeddings");
    const pipeline = buildAggragationPipeline(queryEmbedding);

    const results = await collection.aggregate(pipeline).toArray();

    if (!results.length) {
      return res.json({ answer: "No relevant information found." });
    }

    // 3️⃣ Build context
    const context = results.map((r) => r.text).join("\n\n");

    // 4️⃣ Generate answer
    const answer = await getAnswerFromLLM(query, context);

    res.json({ answer });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 RAG server running on port ${PORT}`)
);
