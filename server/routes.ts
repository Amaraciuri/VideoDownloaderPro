import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { db } from "./db";
import { aiTitles, insertAiTitleSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function registerRoutes(app: Express): Promise<Server> {
  // AI thumbnail analysis endpoint
  app.post("/api/analyze-thumbnail", async (req, res) => {
    try {
      const { thumbnailUrl, originalTitle, userApiKey } = req.body;

      if (!thumbnailUrl) {
        return res.status(400).json({ error: "Thumbnail URL is required" });
      }

      // Use user's API key if provided, otherwise use system key
      const aiClient = userApiKey 
        ? new OpenAI({ apiKey: userApiKey })
        : openai;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await aiClient.chat.completions.create({
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
      const extractedTitle = result.title || result.extracted_text || result.suggestion || "Titolo non disponibile";
      
      // Save the AI title to database for future use
      try {
        await db.insert(aiTitles).values({
          videoId: req.body.videoId || '',
          originalTitle: originalTitle,
          aiTitle: extractedTitle,
          thumbnailUrl: thumbnailUrl,
          confidence: (result.confidence || 0.8).toString()
        }).onConflictDoUpdate({
          target: aiTitles.videoId,
          set: {
            aiTitle: extractedTitle,
            confidence: (result.confidence || 0.8).toString(),
            updatedAt: new Date()
          }
        });
      } catch (dbError) {
        console.error("Error saving AI title to database:", dbError);
        // Continue anyway, don't fail the request
      }
      
      res.json({ 
        aiTitle: extractedTitle,
        confidence: result.confidence || 0.8
      });

    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ error: "Failed to analyze thumbnail" });
    }
  });

  // Get existing AI titles for video IDs
  app.post("/api/get-ai-titles", async (req, res) => {
    try {
      const { videoIds } = req.body;

      if (!Array.isArray(videoIds)) {
        return res.status(400).json({ error: "videoIds must be an array" });
      }

      const existingTitles = await db
        .select()
        .from(aiTitles)
        .where(eq(aiTitles.videoId, videoIds[0])); // This will be improved to handle multiple IDs

      // Create a map of video ID to AI title for easier lookup
      const titleMap: Record<string, string> = {};
      for (const videoId of videoIds) {
        const title = await db
          .select()
          .from(aiTitles)
          .where(eq(aiTitles.videoId, videoId))
          .limit(1);
        
        if (title.length > 0) {
          titleMap[videoId] = title[0].aiTitle;
        }
      }

      res.json({ titles: titleMap });

    } catch (error) {
      console.error("Error fetching AI titles:", error);
      res.status(500).json({ error: "Failed to fetch AI titles" });
    }
  });

  // Bulk AI thumbnail analysis endpoint
  app.post("/api/analyze-thumbnails-bulk", async (req, res) => {
    try {
      const { videos, userApiKey } = req.body;

      if (!Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: "Videos array is required and must not be empty" });
      }

      // Use user's API key if provided, otherwise use system key
      const aiClient = userApiKey 
        ? new OpenAI({ apiKey: userApiKey })
        : openai;

      type BulkResult = {
        videoId: string;
        aiTitle: string;
        confidence: number;
        cached: boolean;
      };

      type BulkError = {
        videoId: string;
        error: string;
        cached: boolean;
      };

      const results: BulkResult[] = [];
      const errors: BulkError[] = [];

      // Process videos in batches to avoid rate limits
      const batchSize = 5; // Process 5 videos at a time
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (video) => {
          try {
            const { videoId, thumbnailUrl, originalTitle } = video;

            if (!videoId || !thumbnailUrl) {
              throw new Error(`Missing required fields for video ${videoId || 'unknown'}`);
            }

            // Check if we already have an AI title for this video
            const existingTitle = await db
              .select()
              .from(aiTitles)
              .where(eq(aiTitles.videoId, videoId))
              .limit(1);

            if (existingTitle.length > 0) {
              return {
                videoId,
                aiTitle: existingTitle[0].aiTitle,
                confidence: parseFloat(existingTitle[0].confidence || "0.8"),
                cached: true
              };
            }

            // Generate AI title using OpenAI
            const response = await aiClient.chat.completions.create({
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
            const extractedTitle = result.title || result.extracted_text || result.suggestion || "Titolo non disponibile";
            
            // Save to database
            await db.insert(aiTitles).values({
              videoId,
              originalTitle: originalTitle || '',
              aiTitle: extractedTitle,
              thumbnailUrl,
              confidence: (result.confidence || 0.8).toString()
            }).onConflictDoUpdate({
              target: aiTitles.videoId,
              set: {
                aiTitle: extractedTitle,
                confidence: (result.confidence || 0.8).toString(),
                updatedAt: new Date()
              }
            });

            return {
              videoId,
              aiTitle: extractedTitle,
              confidence: result.confidence || 0.8,
              cached: false
            };

          } catch (error) {
            console.error(`Error processing video ${video.videoId}:`, error);
            return {
              videoId: video.videoId,
              error: error instanceof Error ? error.message : 'Unknown error',
              cached: false
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Separate successful results from errors
        batchResults.forEach(result => {
          if ('error' in result && result.error) {
            errors.push(result as BulkError);
          } else {
            results.push(result as BulkResult);
          }
        });

        // Add a small delay between batches to be respectful to API limits
        if (i + batchSize < videos.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      res.json({ 
        results,
        errors,
        total: videos.length,
        successful: results.length,
        failed: errors.length
      });

    } catch (error) {
      console.error("Bulk AI analysis error:", error);
      res.status(500).json({ error: "Failed to process bulk AI analysis" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
