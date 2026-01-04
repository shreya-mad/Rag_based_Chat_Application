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
// async function getEmbeddings(query) {
//   const resp = await embeddingModel.embedContent(query);
//   return resp.embedding.values;
// }

// // ===============================
// // ✅ Gemini Answer Generation
// // ===============================
// async function getAnswerFromLLM(query, context) {
//   const prompt = `
// You are a helpful assistant and college placement advisor. 
// Use the provided context from the college placement brochure/data to answer the user's question accurately.

// If the answer is not in the context, politely inform the user that you don't have that specific information yet.

// Context:
// ---
// ${context}
// ---

// Question: ${query}

// Answer:`;

//   try {
//     const result = await textModel.generateContent(prompt);
//     const response = await result.response;
//     return response.text();
//   } catch (error) {
//     console.error("LLM Error:", error.message);
//     return "I'm sorry, I encountered an error while generating your answer.";
//   }
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
//     console.log(`🔍 Processing query: "${query}"`);

//     // 1️⃣ Generate query embedding
//     const queryEmbedding = await getEmbeddings(query);

//     // 2️⃣ Vector search
//     const collection = await getCollection("pdf_embeddings");
//     const pipeline = buildAggregationPipeline(queryEmbedding);

//     const results = await collection.aggregate(pipeline).toArray();

//     if (!results || results.length === 0) {
//       return res.json({ 
//         answer: "I couldn't find any relevant information in the placement records to answer that question." 
//       });
//     }

//     // 3️⃣ Build context from retrieved chunks
//     const context = results.map((r) => r.text).join("\n\n");

//     // 4️⃣ Generate answer via LLM
//     const answer = await getAnswerFromLLM(query, context);

//     res.json({ 
//       answer,
//       sources: results.length // Optional: let user know how many chunks were used
//     });

//   } catch (error) {
//     console.error("❌ API Error:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// ===============================
// ✅ Generate embeddings (Updated with Error Catching)
// ===============================
async function getEmbeddings(query) {
  try {
    const resp = await embeddingModel.embedContent(query);
    return resp.embedding.values;
  } catch (error) {
    // Detect if the limit was reached during embedding
    if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
      throw new Error("LIMIT_REACHED");
    }
    throw error;
  }
}

// ===============================
// ✅ Gemini Answer Generation (Updated with Limit Catching)
// ===============================
async function getAnswerFromLLM(query, context) {
  const prompt = `
You are a helpful assistant and college placement advisor. 
Use the provided context to answer the question accurately.
Context:
${context}

Question: ${query}
Answer:`;

  try {
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("LLM Error:", error.message);
    
    // Check for quota/limit error
    if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
      return "Sorry 😔, We've reached our daily free limit of AI responses. Please try again tomorrow or contact the administrator!";
    }
    
    return "I'm sorry, I encountered an error while generating your answer.";
  }
}

// ===============================
// ✅ RAG Endpoint (Updated)
// ===============================
app.post("/ask", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    console.log(`🔍 Processing query: "${query}"`);

    // 1️⃣ Generate query embedding (With limit check)
    let queryEmbedding;
    try {
      queryEmbedding = await getEmbeddings(query);
    } catch (err) {
      if (err.message === "LIMIT_REACHED") {
        return res.json({ 
          answer: "🚀 The AI service limit has been reached for today. Please try again tomorrow morning!" 
        });
      }
      throw err; // Pass other errors to the main catch block
    }

    // 2️⃣ Vector search
    const collection = await getCollection("pdf_embeddings");
    const pipeline = buildAggregationPipeline(queryEmbedding);
    const results = await collection.aggregate(pipeline).toArray();

    if (!results || results.length === 0) {
      return res.json({ 
        answer: "I couldn't find any relevant information in the placement records." 
      });
    }

    // 3️⃣ Build context
    const context = results.map((r) => r.text).join("\n\n");

    // 4️⃣ Generate answer via LLM (With built-in limit check)
    const answer = await getAnswerFromLLM(query, context);

    res.json({ 
      answer,
      sources: results.length 
    });

  } catch (error) {
    console.error("❌ API Error:", error.message);
    res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
});

// ===============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 RAG server running on http://localhost:${PORT}`)
);
