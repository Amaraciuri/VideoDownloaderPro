import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function registerRoutes(app: Express): Promise<Server> {
  // AI thumbnail analysis endpoint
  app.post("/api/analyze-thumbnail", async (req, res) => {
    try {
      const { thumbnailUrl, originalTitle } = req.body;

      if (!thumbnailUrl) {
        return res.status(400).json({ error: "Thumbnail URL is required" });
      }

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at reading text in video thumbnails. Extract any visible text or titles from the image and suggest a descriptive title. Focus on any overlaid text, titles, or captions. If there's no readable text, describe the main subject matter instead. Keep the response concise and in Italian if the original content appears to be in Italian. Always respond with JSON in this format: {\"title\": \"extracted or suggested title\", \"confidence\": 0.9}"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this video thumbnail and extract or suggest a meaningful title. The original filename is: "${originalTitle}". Look for any text, titles, or captions in the image. Respond with JSON containing the title.`
              },
              {
                type: "image_url",
                image_url: {
                  url: thumbnailUrl
                }
              }
            ],
          },
        ],
        max_tokens: 100,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      res.json({ 
        aiTitle: result.title || result.extracted_text || result.suggestion || "Titolo non disponibile",
        confidence: result.confidence || 0.8
      });

    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ error: "Failed to analyze thumbnail" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
