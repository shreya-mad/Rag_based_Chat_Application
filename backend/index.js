// import express from "express";
// import bodyParser from "body-parser";
// import dotenv from "dotenv";
// import cors from "cors";
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { getCollection } from "./db.js";

// dotenv.config();

// const app = express();
// app.use(bodyParser.json());
// app.use(cors());

// // ===============================
// // ✅ Gemini setup
// // ===============================
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ✅ USE YOUR MODEL NAME AS-IS
// const embeddingModel = genAI.getGenerativeModel({
//   model: "models/gemini-embedding-001",
// });

// const textModel = genAI.getGenerativeModel({
//   model: "gemini-2.5-flash",
// });

// // ===============================
// // ✅ Vector Search Pipeline
// // ===============================
// function buildAggragationPipeline(queryEmbedding) {
//   return [
//     {
//       $vectorSearch: {
//         index: "vector_index_rag",
//         path: "embedding",
//         queryVector: queryEmbedding,
//         numCandidates: 10,
//         limit: 3,
//       },
//     },
//     {
//       $project: {
//         text: 1,
//         score: { $meta: "vectorSearchScore" },
//       },
//     },
//   ];
// }

// // ===============================
// // ✅ Generate embeddings
// // ===============================
// async function getEmbeddings(query) {
//   const resp = await embeddingModel.embedContent(query);
//   return resp.embedding.values;
// }

// // ===============================
// // ✅ Gemini Answer Generation (FIXED FORMAT)
// // ===============================
// async function getAnswerFromLLM(query, context) {
//   const prompt = `
// You are a helpful assistant having expertise in college placement advisor  .
// Here are the sample questions format you should be getting and answering:
// what are the companies that have visited our college for placement?
// what is the average package of the companies that have visited our college for placement?
// what is the maximum package of the companies that have visited our college for placement?
// what is the minimum package of the companies that have visited our college for placement?
// what is the total number of companies that have visited our college for placement?
// what is the total number of students that have visited our college for placement?
// what is the total number of students that have visited our college for placement?SS
// Use the provided context to answer the question accurately.


// Context:
// ${context}

// Question:
// ${query}
// `;

//   const result = await textModel.generateContent({
//     contents: [
//       {
//         role: "user",
//         parts: [{ text: prompt }],
//       },
//     ],
//   });

//   return result.response.text();
// }

// // ===============================
// // ✅ RAG Endpoint
// // ===============================
// app.post("/ask", async (req, res) => {
//   const { query } = req.body;

//   if (!query) {
//     return res.status(400).json({ error: "Query is required" });
//   }

//   try {
//     // 1️⃣ Generate query embedding
//     const queryEmbedding = await getEmbeddings(query);

//     // 2️⃣ Vector search
//     const collection = await getCollection("pdf_embeddings");
//     const pipeline = buildAggragationPipeline(queryEmbedding);

//     const results = await collection.aggregate(pipeline).toArray();

//     if (!results.length) {
//       return res.json({ answer: "No relevant information found." });
//     }

//     // 3️⃣ Build context
//     const context = results.map((r) => r.text).join("\n\n");

//     // 4️⃣ Generate answer
//     const answer = await getAnswerFromLLM(query, context);

//     res.json({ answer });
//   } catch (error) {
//     console.error("❌ Error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // ===============================
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () =>
//   console.log(`🚀 RAG server running on port ${PORT}`)
// );

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

// For Embeddings
const embeddingModel = genAI.getGenerativeModel({
  model: "models/gemini-embedding-001",
});

// For Text Generation (Updated to stable 1.5 Flash)
const textModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash", 
});

// ===============================
// ✅ Vector Search Pipeline
// ===============================
function buildAggregationPipeline(queryEmbedding) {
  return [
    {
      $vectorSearch: {
        index: "vector_index", // Ensure this index name matches your MongoDB Atlas setup
        path: "embedding",        // This must match the field name in your documents
        queryVector: queryEmbedding,
        numCandidates: 100,       // Higher candidates = better accuracy
        limit: 5,                 // Increased context window for better LLM performance
      },
    },
    {
      $project: {
        _id: 0,
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
// ✅ Gemini Answer Generation
// ===============================
async function getAnswerFromLLM(query, context) {
  const prompt = `
You are a helpful assistant and college placement advisor. 
Use the provided context from the college placement brochure/data to answer the user's question accurately.

If the answer is not in the context, politely inform the user that you don't have that specific information yet.

Context:
---
${context}
---

Question: ${query}

Answer:`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("LLM Error:", error.message);
    return "I'm sorry, I encountered an error while generating your answer.";
  }
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
    console.log(`🔍 Processing query: "${query}"`);

    // 1️⃣ Generate query embedding
    const queryEmbedding = await getEmbeddings(query);

    // 2️⃣ Vector search
    const collection = await getCollection("pdf_embeddings");
    const pipeline = buildAggregationPipeline(queryEmbedding);

    const results = await collection.aggregate(pipeline).toArray();

    if (!results || results.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant information in the placement records to answer that question." 
      });
    }

    // 3️⃣ Build context from retrieved chunks
    const context = results.map((r) => r.text).join("\n\n");

    // 4️⃣ Generate answer via LLM
    const answer = await getAnswerFromLLM(query, context);

    res.json({ 
      answer,
      sources: results.length // Optional: let user know how many chunks were used
    });

  } catch (error) {
    console.error("❌ API Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ===============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 RAG server running on http://localhost:${PORT}`)
);
