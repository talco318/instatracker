import { InstagramService } from './InstagramService';
import OpenAI from 'openai';

// Service to detect baby images in recent posts
export interface BabyDetection {
  url: string;
  has_baby: boolean;
  babies: Array<{ bbox: number[]; confidence: number; notes?: string }>;
}
export class NoBabyNoCryService {
  private instagramService = new InstagramService();
  private openai: any;

  constructor() {
  this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  // Fetch recent media URLs (stub: uses InstagramService.getUserMediaUrls placeholder)
  async getRecentMediaUrls(username: string): Promise<string[]> {
    // Fetch the user's recent media posts via RapidAPI
    const userId = await this.instagramService.getUserIdByUsername(username);
    let mediaItems: any[];
    try {
      mediaItems = await this.instagramService.getAllMediaByUserId(userId);
    } catch (e: any) {
      // RapidAPI free-tier doesn't support listing user media
      if (e.message && e.message.includes("Endpoint '/media' does not exist")) {
        throw new Error('Media listing not available on free-tier plan. Upgrade your RapidAPI plan to access user posts.');
      }
      throw e;
    }
  console.log(`NoBabyNoCry: fetched ${mediaItems.length} media items for ${username}`);
  console.log('NoBabyNoCry: raw media items:', mediaItems);
  const urls: string[] = [];
    // Take up to 12 recent items
    for (const item of mediaItems.slice(0, 12)) {
      // Try common URL fields
      const url = item.display_url || item.display_src || item.thumbnail_src || item.image_versions2?.candidates?.[0]?.url;
      if (typeof url === 'string' && url) {
        urls.push(url);
      }
    }
    console.log(`NoBabyNoCry: extracted ${urls.length} URLs for ${username}`);
    console.log('NoBabyNoCry: URLs:', urls);
    if (urls.length === 0) {
      // Likely unsupported by free-tier
      throw new Error('Media listing not available on free-tier plan. Upgrade your RapidAPI plan to access user posts.');
    }
    return urls;
  }

  // Analyze a single image URL using JSON schema with bounding box detection
  async analyzeImageSchema(url: string): Promise<{ has_baby: boolean; babies: Array<{ bbox: number[]; confidence: number; notes?: string }> }> {
    const schema = {
      name: 'baby_detection',
      schema: {
        type: 'object',
        properties: {
          has_baby: { type: 'boolean' },
          babies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bbox: {
                  description: '[x, y, width, height] normalized 0-1',
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 4,
                  maxItems: 4
                },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                notes: { type: 'string' }
              },
              required: ['bbox', 'confidence']
            }
          }
        },
        required: ['has_baby', 'babies'],
        additionalProperties: false
      },
      strict: true
    };
    const promptText = `Determine if the image contains a human baby/infant (<24 months). If present, return one bbox per baby with normalized coordinates (0–1). Only output JSON matching the schema.`;
    const formatObj = {
      name: schema.name,
      type: 'json_schema',
      json_schema: schema.schema
    };
    console.log('NoBabyNoCry: using text.format:', formatObj);
    const resp = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      text: {
        format: formatObj
      },
      // Wrap inputs in a 'message' so the API accepts the content types
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: promptText },
            { type: 'input_image', image_url: url }
          ]
        }
      ]
    });

    // Debug the full response (helpful for schema failures)
    console.log('NoBabyNoCry: OpenAI responses.create raw output:', resp);

    // Try multiple locations for the JSON schema output
    let parsed: any = {};
    try {
      if (resp.output_text) {
        parsed = JSON.parse(resp.output_text);
      } else if (Array.isArray(resp.output)) {
        for (const outItem of resp.output) {
          if (!outItem || !Array.isArray(outItem.content)) continue;
          for (const c of outItem.content) {
            // json_schema content (newer SDKs may place parsed JSON here)
            if (c.type === 'json_schema' && c.json_schema) {
              parsed = c.json_schema;
              break;
            }
            // output_text content with JSON string
            if (c.type === 'output_text' && typeof c.text === 'string') {
              try {
                parsed = JSON.parse(c.text);
                break;
              } catch (e) {
                // not JSON, ignore
              }
            }
          }
          if (Object.keys(parsed).length) break;
        }
      }
    } catch (e) {
      console.error('NoBabyNoCry: failed to parse OpenAI JSON output:', e, 'raw output_text:', resp.output_text);
    }

    return { has_baby: !!parsed.has_baby, babies: parsed.babies || [] };
  }

  // Main entry: returns structured baby detection per URL
  async detect(username: string): Promise<BabyDetection[]> {
    const urls = await this.getRecentMediaUrls(username);
    const results: BabyDetection[] = [];
    for (const url of urls.slice(0, 12)) {
      try {
        const detection = await this.analyzeImageSchema(url);
        results.push({ url, ...detection });
      } catch (e: any) {
        console.error(`Error analyzing ${url}:`, e);
      }
    }
    return results;
  }
}
