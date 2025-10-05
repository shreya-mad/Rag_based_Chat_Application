import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from 'cors';
import { getCollection } from "./db.js";

dotenv.config();

const app = express();
app.use(bodyParser.json()); // ✅ To parse JSON request bodies
app.use(cors())
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildAggragationPipeline(queryEmbedding) {
    return [
        {
            $vectorSearch: {
                queryVector: queryEmbedding,
                path: "embedding",
                numCandidates: 10,
                limit: 3,
                index: "insurance_vector_index", // ✅ Make sure this matches your Atlas index name
            },
        },
        {
            $project: {
                text: 1,
                score: { $meta: "vectorSearchScore" },
            },
        },
    ]
}

async function getEmbeddings(query) {
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        dimensions: 512, // Optional but recommended for consistent setup
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    return queryEmbedding || [];
}

async function getAnswerFromLLM(query, context) {
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant that answers questions based only on the provided context.",
            },
            {
                role: "user",
                content: `Context:\n${context}\n\nQuestion: ${query}`,
            },
        ],
    });
    const answer = completion.choices[0].message.content;
    return answer;
}
// ✅ Ask endpoint - complete RAG pipeline
app.post("/ask", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
        // 1️⃣ Generate query embedding
        const queryEmbedding = await getEmbeddings(query);
        // 2️⃣ Search most relevant chunks from MongoDB
        const collection = await getCollection('insurance_embeddings');
        const pipeline = buildAggragationPipeline(queryEmbedding);
        // R- Retrival Part
        const results = await collection.aggregate(pipeline).toArray();
        if (results.length === 0) {
            return res.json({ answer: "No relevant information found." });
        }
        // Combine top results into context
        const context = results.map((r) => r.text).join("\n\n");
        // 3️⃣ Send to GPT to generate final answer
        const answer = await getAnswerFromLLM(query, context);
        res.json({ answer });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 RAG server running on port ${PORT}`));
