import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { closeConn, getCollection } from "../db.js";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

    // Convert claim objects to readable text
    const claimText =
        claims.length > 0
            ? claims
                .map(
                    (c, i) =>
                        `Claim ${i + 1}: ID ${c.claimId}, Date ${c.date}, Amount ₹${c.amount}, Reason: ${c.reason}, Status: ${c.status}`
                )
                .join("; ")
            : "No claim history";

    // Concatenate all details into one text string
    return `
        Policy Number: ${policyNumber}.
        Customer Name: ${name}, Age: ${age}.
        Insurance Type: ${insuranceType}.
        Plan: ${plan}.
        Premium: ₹${premium}, Coverage: ₹${coverage}.
        Policy Period: ${startDate} to ${endDate}.
        Claims: ${claimText}.
  `;
}

async function generateAndStoreEmbeddings() {
    try {
        // 1️⃣ Read insurance data
        const fileData = fs.readFileSync("./seed/insurance_data.json", "utf-8");
        const insuranceArray = JSON.parse(fileData);
        console.log(`📄 Loaded ${insuranceArray.length} insurance records`);

        const documents = [];

        // 2️⃣ Generate embeddings
        for (const record of insuranceArray) {
            const textChunk = flattenInsuranceRecord(record);

            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: textChunk,
                dimensions: 512,
            });

            const embedding = response.data[0].embedding;

            documents.push({
                text: textChunk.trim(),
                embedding,
                policyNumber: record.policyNumber,
                customerName: record.name,
                insuranceType: record.insuranceType,
            });

            console.log(`✅ Generated embedding for ${record.name}`);
        }

        // 3️⃣ Connect to MongoDB
        const collection = await getCollection("insurance_embeddings");

        // 4️⃣ Insert all documents in bulk
        if (documents.length > 0) {
            await collection.insertMany(documents);
            console.log(`🎯 Inserted ${documents.length} embeddings into MongoDB.`);
        }
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

generateAndStoreEmbeddings();
