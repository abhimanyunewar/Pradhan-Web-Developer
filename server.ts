import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware with elevated body limit to handle files uploaded as base64 safely
  app.use(express.json({ limit: "25mb" }));

  // AI OCR parsing endpoint for scanned documents or image screenshots
  app.post("/api/parse-holiday", async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body;
      
      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: "Missing required file contents (base64Data and mimeType)." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY environment variable is not defined on the server side. Please ensure the secret is saved." 
        });
      }

      // Initialize the Gemini SDK container
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const documentPart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const promptText = `
        You are an expert academic scheduler agent. Analyze this holiday circular, event list, or academic calendar sheet, and extract all designated official holidays or non-teaching days.
        
        Rules:
        1. Parse the document looking for dates and holiday explanations (e.g. "Republic Day", "Deepavali", "Good Friday").
        2. Identify the target calendar year from the document (typically 2026, or as written: "Calendar Year 2026").
        3. Convert all extracted holidays to a standard representation.
        4. Dates MUST be formatted strictly as 'YYYY-MM-DD'.
        5. The holiday names must be cleanly extracted (e.g. write "Republic Day", do not include bullet symbols, raw dates, or weekdays in the name).
        6. Return a flat JSON array of structured holiday blocks.
      `;

      // Helper function to call Gemini with robust retry logic and model fallback redundancy
      const generateWithFallback = async () => {
        const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
        let lastError: any = null;

        for (const modelName of models) {
          let delay = 1500; // start with 1.5s delay
          const maxAttempts = modelName === "gemini-3.5-flash" ? 3 : 1;

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              console.log(`[AI-OCR] Parsing holidays using '${modelName}' (Attempt ${attempt}/${maxAttempts})...`);
              const response = await ai.models.generateContent({
                model: modelName,
                contents: [documentPart, { text: promptText }],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.ARRAY,
                    description: "List of parsed academic holidays",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        date: {
                          type: Type.STRING,
                          description: "The date of the holiday formatted strictly in 'YYYY-MM-DD' layout.",
                        },
                        name: {
                          type: Type.STRING,
                          description: "Cleaned official title of the holiday.",
                        },
                      },
                      required: ["date", "name"],
                    },
                  },
                },
              });
              return response;
            } catch (error: any) {
              lastError = error;
              const errorMsg = error?.message || "";
              const status = error?.status || error?.code || "";
              
              const isTransient = 
                status === 503 || 
                status === 429 || 
                status === "UNAVAILABLE" || 
                errorMsg.includes("503") || 
                errorMsg.includes("UNAVAILABLE") || 
                errorMsg.includes("high demand") || 
                errorMsg.includes("overloaded") ||
                errorMsg.includes("temporary");

              console.warn(`[AI-OCR] Warning: Model '${modelName}' attempt ${attempt} failed:`, errorMsg);
              
              if (!isTransient) {
                // For non-transient errors (invalid credentials, API key issues, bad requests), throw immediately
                throw error;
              }

              if (attempt < maxAttempts) {
                const jitter = Math.random() * 500;
                const nextWait = delay + jitter;
                console.log(`[AI-OCR] Transient error. Backing off for ${Math.round(nextWait)}ms before retrying...`);
                await new Promise((r) => setTimeout(r, nextWait));
                delay *= 2; // exponential increase
              }
            }
          }
          console.log(`[AI-OCR] '${modelName}' exhausted all transient retry attempts. Transitioning to fallback...`);
        }
        throw lastError;
      };

      const response = await generateWithFallback();

      let jsonText = response.text || "[]";
      
      // Clean up markdown wrapping artifacts just in case
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.substring(7, jsonText.length - 3).trim();
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.substring(3, jsonText.length - 3).trim();
      }

      const parsedHolidays = JSON.parse(jsonText.trim());
      res.json({ holidays: parsedHolidays });
    } catch (error: any) {
      console.error("Error executing Gemini Document OCR:", error);
      
      // Distinguish user messages for transient vs permanent failures
      let clientErrorMessage = "An exception occurred while processing the multimodal document scan with Gemini.";
      if (error?.message && (error.message.includes("503") || error.message.includes("high demand") || error.message.includes("UNAVAILABLE"))) {
        clientErrorMessage = "The Gemini AI model is currently under excessively high global load. The system attempted multiple automatic retries and falling back to lighter models, but the server is still overloaded. Please wait a moment and try uploading again, or enter your holidays manually using the 'Add Custom Holiday' controls.";
      } else if (error?.message) {
        clientErrorMessage = `AI Holiday Parser failed: ${error.message}`;
      }
      
      res.status(500).json({ error: clientErrorMessage });
    }
  });

  // Serve Vite app in development, static client bundle in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer();
