require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function migrate() {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("No API key");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const oldMemoriesPath = path.join(__dirname, 'data', 'memories_oci.json');
    const newMemoriesPath = path.join(__dirname, 'data', 'memories_migrated.json');

    const data = JSON.parse(fs.readFileSync(oldMemoriesPath, 'utf8'));
    console.log(`Loaded ${data.length} memories for batch processing.`);

    const migrated = [];
    for (let i = 0; i < data.length; i++) {
        const memory = data[i];
        console.log(`[${i + 1}/${data.length}] Migrating: ${memory.text.substring(0, 50)}...`);

        try {
            const result = await model.embedContent({
                content: { parts: [{ text: memory.text }] },
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: 768
            });
            memory.vector = result.embedding.values;
            migrated.push(memory);
        } catch (e) {
            console.error("Error for:", memory.text, e.message);
        }
        // 4000ms delay to keep within 15 RPM safety boundary
        await new Promise(r => setTimeout(r, 4000));
    }

    fs.writeFileSync(newMemoriesPath, JSON.stringify(migrated, null, 2));
    console.log("✅ Migration complete. Saved to", newMemoriesPath);
}

migrate();
