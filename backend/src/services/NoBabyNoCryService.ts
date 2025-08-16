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

  // Analyze a single image URL using the Responses API with text.format.json_schema
  async analyzeImageSchema(url: string): Promise<{ has_baby: boolean; babies: Array<{ bbox: number[]; confidence: number; notes?: string }> }> {
    // New compact schema shape (returns has_baby, confidence, reason)
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        has_baby: { type: 'boolean' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' }
      },
      required: ['has_baby', 'confidence', 'reason']
    };

    const promptText = `Is there a baby in this image? Return ONLY JSON matching the schema.`;

    console.log('NoBabyNoCry: calling OpenAI.responses.create with text.format.json_schema for', url);

    const resp = await this.openai.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: promptText },
            { type: 'input_image', image_url: url }
          ]
        }
      ],
      // per the working example: place schema under text.format
      text: {
        format: {
          type: 'json_schema',
          name: 'BabyDetection',
          strict: true,
          schema
        }
      }
    });

    console.log('NoBabyNoCry: OpenAI raw response:', resp);

    // Parse the textual output; newer SDKs put the final combined text at resp.output_text
    let parsed: any = {};
    try {
      if (resp.output_text && typeof resp.output_text === 'string' && resp.output_text.trim()) {
        parsed = JSON.parse(resp.output_text);
      } else if (Array.isArray(resp.output)) {
        // fallback: look through output array for output_text-like content
        for (const outItem of resp.output) {
          if (!outItem) continue;
          const content = outItem.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (!c) continue;
              if (c.type === 'output_text' && typeof c.text === 'string') {
                try {
                  parsed = JSON.parse(c.text);
                  break;
                } catch (err) {
                  // ignore
                }
              }
            }
          }
          if (Object.keys(parsed).length) break;
        }
      }
    } catch (e) {
      console.error('NoBabyNoCry: failed to parse OpenAI JSON output:', e, 'raw output_text:', resp.output_text);
    }

    // Map the compact BabyDetection shape into our existing return contract.
    const has_baby = !!parsed.has_baby;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const reason = parsed.reason || '';

    // We don't currently produce bounding boxes with this schema; return a placeholder bbox when a baby is detected.
    const babies = has_baby
      ? [ { bbox: [0, 0, 0, 0], confidence, notes: reason } ]
      : [];

    return { has_baby, babies };
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
