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
  // Verify system password endpoint
  app.post("/api/verify-password", async (req, res) => {
    try {
      const { password } = req.body;
      const systemPassword = process.env.SYSTEM_AI_PASSWORD || 'CHANGE_ME';
      
      if (password === systemPassword) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      console.error("Password verification error:", error);
      res.status(500).json({ error: "Failed to verify password" });
    }
  });

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

  // VdoCipher API proxy routes (to handle CORS issues)
  app.get("/api/vdocipher/folders", async (req, res) => {
    try {
      const { apiKey } = req.query;
      
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: "VdoCipher API key is required" });
      }

      const response = await fetch('https://dev.vdocipher.com/api/videos/folders/root', {
        headers: {
          'Authorization': `Apisecret ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ error: 'Invalid VdoCipher API key. Please check your credentials.' });
        } else {
          return res.status(response.status).json({ error: `VdoCipher API request failed: ${response.status}` });
        }
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("VdoCipher folders error:", error);
      res.status(500).json({ error: "Failed to fetch VdoCipher folders" });
    }
  });

  app.get("/api/vdocipher/videos", async (req, res) => {
    try {
      const { apiKey, folderId } = req.query;
      
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: "VdoCipher API key is required" });
      }

      let url = 'https://dev.vdocipher.com/api/videos';
      if (folderId && folderId !== 'all') {
        url += `?folderId=${folderId}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Apisecret ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ error: 'Invalid VdoCipher API key. Please check your credentials.' });
        } else {
          return res.status(response.status).json({ error: `VdoCipher API request failed: ${response.status}` });
        }
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("VdoCipher videos error:", error);
      res.status(500).json({ error: "Failed to fetch VdoCipher videos" });
    }
  });

  // Zoom API proxy routes (to handle OAuth and API calls)
  app.get("/api/zoom/recordings", async (req, res) => {
    try {
      const { apiKey, apiSecret, accountId } = req.query;
      
      if (!apiKey || !apiSecret || typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
        return res.status(400).json({ error: "Zoom API Key and API Secret are required" });
      }

      // Step 1: Get OAuth token for Server-to-Server auth
      const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      
      // For Server-to-Server OAuth, we need to include account_id if available
      let tokenBody = 'grant_type=client_credentials';
      if (accountId && typeof accountId === 'string') {
        tokenBody += `&account_id=${encodeURIComponent(accountId)}`;
      }
      
      const tokenResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenBody
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Zoom OAuth error:', tokenResponse.status, errorText);
        
        if (tokenResponse.status === 401) {
          return res.status(401).json({ error: 'Invalid Zoom API credentials. Please check your API Key and Secret.' });
        } else if (tokenResponse.status === 400) {
          return res.status(400).json({ 
            error: `Zoom OAuth failed (400): Invalid request. Make sure your app is configured as Server-to-Server OAuth type.`,
            details: errorText
          });
        } else {
          return res.status(tokenResponse.status).json({ error: `Zoom OAuth failed: ${tokenResponse.status}` });
        }
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      console.log('Zoom OAuth successful, token scope:', tokenData.scope);
      console.log('Access token length:', accessToken?.length || 'undefined');

      // Step 2: For Server-to-Server OAuth, we need to first get account info or use account-level endpoints
      // Let's try to get the account's recordings using different approaches
      
      let recordingsResponse;
      
      // Approach 1: Try to get user list first, then get recordings for each user
      try {
        const usersResponse = await fetch('https://api.zoom.us/v2/users', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        console.log('Users API response status:', usersResponse.status);
        if (!usersResponse.ok) {
          const usersErrorText = await usersResponse.text();
          console.log('Users API error:', usersErrorText);
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('Successfully got users data:', usersData.users?.length || 0, 'users');
          
          // Get recordings for the first user (typically the account owner)
          if (usersData.users && usersData.users.length > 0) {
            const userId = usersData.users[0].id;
            recordingsResponse = await fetch(`https://api.zoom.us/v2/users/${userId}/recordings`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            });
          } else {
            return res.status(404).json({ error: 'No users found in the Zoom account.' });
          }
        } else {
          // Approach 2: If users endpoint fails, try the account recordings endpoint directly
          console.log('Users endpoint failed, trying account recordings...');
          recordingsResponse = await fetch('https://api.zoom.us/v2/accounts/me/recordings', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });
        }
      } catch (error) {
        console.error('Error in Zoom API calls:', error);
        return res.status(500).json({ error: 'Failed to fetch Zoom data' });
      }

      if (!recordingsResponse.ok) {
        const errorText = await recordingsResponse.text();
        console.error('Zoom recordings API error:', recordingsResponse.status, errorText);
        
        if (recordingsResponse.status === 401) {
          return res.status(401).json({ 
            error: 'Invalid Zoom access token or insufficient permissions. Make sure your app has the required scopes: cloud_recording:read:list_user_recordings:admin, cloud_recording:read:list_account_recordings:admin, cloud_recording:read:recording:admin',
            details: errorText
          });
        } else {
          return res.status(recordingsResponse.status).json({ 
            error: `Zoom recordings API request failed: ${recordingsResponse.status}`,
            details: errorText
          });
        }
      }

      const recordingsData = await recordingsResponse.json();
      res.json(recordingsData);
      
    } catch (error) {
      console.error("Zoom recordings error:", error);
      res.status(500).json({ error: "Failed to fetch Zoom recordings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
