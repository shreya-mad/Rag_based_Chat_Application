import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"; // Stable ESM import
import { GoogleGenerativeAI } from "@google/generative-ai";
import { closeConn, getCollection } from "../db.js";

// ===============================
// ✅ Resolve current directory
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// ✅ Load .env from backend root
// ===============================
dotenv.config({ path: path.join(__dirname, "../.env") });

// ===============================
// ✅ Gemini setup
// ===============================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
  model: "models/gemini-embedding-001",
});

// ===============================
// ✅ PDFs are in SAME folder as seed.js
// ===============================
const PDF_DIRECTORY = __dirname;

// ===============================
// ✅ Chunk helper
// ===============================
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

// =====================================
// ✅ Extract text from PDF (PDFJS version)
// =====================================
async function extractTextFromPdf(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true, // Prevents issues in Node environment
    });

    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  } catch (error) {
    console.error(`❌ Error parsing PDF ${filePath}:`, error.message);
    return null;
  }
}

// =====================================
// ✅ Generate embeddings from local PDFs
// =====================================
async function generateAndStoreEmbeddingsFromLocalPdfs() {
  try {
    const files = fs.readdirSync(PDF_DIRECTORY);

    const pdfFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      console.log("⚠️ No PDF files found in seed folder");
      return;
    }

    const collection = await getCollection("pdf_embeddings");
    
    // Optional: Clear existing embeddings
    // await collection.deleteMany({});

    for (const file of pdfFiles) {
      const pdfPath = path.join(PDF_DIRECTORY, file);
      const text = await extractTextFromPdf(pdfPath);

      if (!text || !text.trim()) {
        console.warn(`⚠️ Empty or unreadable PDF skipped: ${file}`);
        continue;
      }

      const chunks = chunkText(text);
      console.log(`🧩 Split into ${chunks.length} chunks. Generating embeddings...`);

      const documents = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;

        try {
          const result = await embeddingModel.embedContent(chunk);
          const embedding = result.embedding.values;

          documents.push({
            sourceFile: file,
            sourcePath: pdfPath,
            chunkIndex: i,
            text: chunk,
            embedding,
            createdAt: new Date(),
          });

          process.stdout.write(`.`); 
        } catch (embedError) {
          console.error(`\n❌ Gemini Error on chunk ${i}:`, embedError.message);
        }
      }

      if (documents.length > 0) {
        await collection.insertMany(documents);
        console.log(`\n✅ Finished and stored ${file}`);
      }
    }

    console.log(`\n🎯 All processing complete!`);

  } catch (error) {
    console.error("\n❌ Global Error:", error.message);
  } finally {
    await closeConn();
    console.log("🔌 Database connection closed.");
  }
}

// ===============================
// 🚀 Run seed script
// ===============================
generateAndStoreEmbeddingsFromLocalPdfs();