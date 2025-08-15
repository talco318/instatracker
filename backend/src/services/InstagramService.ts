import https from 'https';
import { URLSearchParams } from 'url';

// Free-tier only: no external HTTP calls required

export interface InstagramProfile {
  username: string;
  isPrivate: boolean;
  followingCount: number;
  /** Numeric Instagram user ID string */
  userId?: string;
  followingList?: string[];
  /** true if this profile is a fallback due to API error */
  isFallback?: boolean;
}

export class InstagramService {
  private apiKey: string;
  private apiHost: string;
  // Shared cache to avoid rate limits: key=username, value={profile, fetchedAt}
  private static profileCache: Map<string, { profile: InstagramProfile; fetchedAt: number }> = new Map();
  // Cache TTL in milliseconds (default 15 minutes)
  private static cacheTTL: number = Number(process.env.PROFILE_CACHE_TTL_MS) || 15 * 60 * 1000;

  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY || '';
    this.apiHost = process.env.RAPIDAPI_HOST || 'instagram-best-experience.p.rapidapi.com';
    
    // Debug logging
    console.log('Instagram Service initialized:');
    console.log('API Key loaded:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT LOADED');
    console.log('API Host:', this.apiHost);
    
    // Validate API key is available
    if (!this.apiKey) {
      throw new Error('RAPIDAPI_KEY environment variable is required but not set');
    }
  }

  /**
   * Fetch profile data, optionally bypassing cache for immediate fresh fetch
   */
  async getProfile(username: string, forceRefresh: boolean = false): Promise<InstagramProfile> {
    const cleanUsername = username.replace('@', '');
    const now = Date.now();
    const cached = InstagramService.profileCache.get(cleanUsername);
    if (!forceRefresh && cached && now - cached.fetchedAt < InstagramService.cacheTTL) {
      return cached.profile;
    }

    // Fetch profile via RapidAPI
    try {
      const query = new URLSearchParams({ username: cleanUsername }).toString();
      const data: any = await new Promise((resolve, reject) => {
        const options = {
          method: 'GET',
          hostname: this.apiHost,
          path: `/profile?${query}`,
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': this.apiHost,
            Accept: 'application/json'
          }
        } as const;
        const req = https.request(options, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString());
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.end();
      });
      // Handle RapidAPI rate limit or other errors
      if (data.status === 'error') {
        console.warn(`RapidAPI /profile error for ${cleanUsername}: ${data.error || 'unknown error'}`);
        if (cached) {
          console.log(`Using cached profile for ${cleanUsername} due to API error`);
          return cached.profile;
        }
        throw new Error(`RapidAPI error: ${data.error || 'unknown error'}`);
      }
      const profile = this.parseProfileShape(data, cleanUsername);
      if (profile) {
  // Mark as real fetch
  (profile as any).isFallback = false;
  InstagramService.profileCache.set(cleanUsername, { profile, fetchedAt: now });
        return profile;
      }
      console.warn(`Unable to parse profile for ${cleanUsername} from RapidAPI response`);
    } catch (error: any) {
      console.warn('Instagram RapidAPI profile fetch failed:', error.message || error);
    }

  // Fallback dummy profile due to API error
    const fallback: InstagramProfile = { username: cleanUsername, isPrivate: false, followingCount: 0, isFallback: true };
    InstagramService.profileCache.set(cleanUsername, { profile: fallback, fetchedAt: now });
    return fallback;
  }

  /**
   * Fetch the numeric user ID for a given Instagram username via RapidAPI.
   */
  async getUserIdByUsername(username: string): Promise<string> {
    const cleanUsername = username.replace('@', '');
    const query = new URLSearchParams({ username: cleanUsername }).toString();
  const data: any = await new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        hostname: this.apiHost,
        path: `/user_id_by_username?${query}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
          Accept: 'application/json'
        }
      } as const;
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    // Log raw response for debugging
    console.log(`InstagramService: /user_id_by_username response for ${cleanUsername}:`, data);
    // If RapidAPI returned an error message (e.g., quota exceeded), propagate it
    if (data.message) {
      console.error(`InstagramService: error message from /user_id_by_username: ${data.message}`);
      throw new Error(data.message);
    }
    // Support multiple possible fields for user ID
  const userId = data.UserID
      || data.user_id
      || data.data?.user_id
      || data.data?.id
      || data.data?.pk
      || data.data?.user?.pk
      || data.graphql?.user?.id
      || data.id
      || data.id_str;
    // Debug resolved userId
    console.log(`InstagramService: resolved userId for ${cleanUsername}:`, userId);
    if (!userId) {
      console.error(`InstagramService: failed to resolve userId for ${cleanUsername}`);
      throw new Error(`Unable to fetch user ID for ${cleanUsername}`);
    }
    return userId.toString();
  }

  /**
   * Fetch the list of usernames the user is following via RapidAPI.
   */
  async getFollowingList(username: string): Promise<string[]> {
    const userId = await this.getUserIdByUsername(username);
    // Fetch all following via pagination
    return this.getAllFollowingByUserId(userId);
  }
  
  /**
   * Fetch followers by numeric user ID from RapidAPI free-tier
   * Returns raw JSON with users, next_max_id, status
   */
  async getFollowersByUserId(userId: string, maxId?: string): Promise<any> {
    const params = new URLSearchParams({ user_id: userId });
    if (maxId) params.append('max_id', maxId);
    const query = params.toString();
    // native https request
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        hostname: this.apiHost,
        path: `/user_followers?${query}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
          Accept: 'application/json'
        }
      } as const;
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
  /**
   * Fetch a page of media for a user
   */
  async getMediaByUserId(userId: string, maxId?: string): Promise<any> {
  const params = new URLSearchParams({ user_id: userId });
  // Use next_max_id for pagination as per RapidAPI feed endpoint
  if (maxId) params.append('next_max_id', maxId);
    const query = params.toString();
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        hostname: this.apiHost,
        // Use the feed endpoint to list recent media posts
        path: `/feed?${query}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
          Accept: 'application/json'
        }
      } as const;
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
  /**
   * Fetch all media posts by paging
   */
  async getAllMediaByUserId(userId: string): Promise<any[]> {
    const allItems: any[] = [];
    let nextId: string | undefined;
    do {
      const resp: any = await this.getMediaByUserId(userId, nextId);
      // Debug raw media page response
  console.log(`InstagramService: /feed response for ${userId}:`, resp);
      // Check for API error message
      if (resp.message) {
        console.error(`InstagramService: /feed error for ${userId}: ${resp.message}`);
        throw new Error(resp.message);
      }
      // Support various shapes for media list
      let pageItems: any[] = [];
      if (Array.isArray(resp.items)) {
        pageItems = resp.items;
      } else if (Array.isArray(resp.data?.items)) {
        pageItems = resp.data.items;
      } else if (Array.isArray(resp.media)) {
        pageItems = resp.media;
      } else if (Array.isArray(resp.data?.media)) {
        pageItems = resp.data.media;
      }
      if (pageItems.length) {
        allItems.push(...pageItems);
      }
      // Support pagination cursor in multiple fields
      nextId = resp.next_max_id ?? resp.data?.next_max_id ?? resp.end_cursor;
    } while (nextId && allItems.length < 12);
    return allItems;
  }
  
  /**
   * Fetch all followers for a userId by paging through results
   */
  async getAllFollowersByUserId(userId: string): Promise<any[]> {
    const allUsers: any[] = [];
    let nextId: string | undefined;
    do {
      const resp: any = await this.getFollowersByUserId(userId, nextId);
      if (Array.isArray(resp.users)) {
        allUsers.push(...resp.users);
      }
      nextId = resp.next_max_id;
    } while (nextId);
    return allUsers;
  }
  
  /**
   * Fetch a page of accounts the user is following
   */
  async getFollowingByUserId(userId: string, maxId?: string): Promise<any> {
    const params = new URLSearchParams({ user_id: userId });
    if (maxId) params.append('max_id', maxId);
    const query = params.toString();
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        hostname: this.apiHost,
            path: `/following?${query}`,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
          Accept: 'application/json'
        }
      } as const;
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            resolve(data);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
  
  /**
   * Fetch all accounts the user is following by paging
   */
  async getAllFollowingByUserId(userId: string): Promise<any[]> {
    // Fetch and accumulate all following usernames via paging
    const allUsernames: string[] = [];
    let next: string | undefined;
    do {
      const resp: any = await this.getFollowingByUserId(userId, next);
      // parseFollowingShape handles users array under various patterns
      const pageList = this.parseFollowingShape(resp);
      allUsernames.push(...pageList);
      next = resp.next_max_id;
    } while (next);
    return allUsernames;
  }

  // Flexible parsers to handle multiple provider response shapes
  private parseProfileShape(data: any, fallbackUsername: string): InstagramProfile | null {
  if (!data) return null;
  // Log raw profile data for debugging
  console.log(`RapidAPI /profile response for ${fallbackUsername}:`, data);

    // Common shapes
    const candidates = [
      () => ({ username: data.username, isPrivate: data.is_private, followingCount: data.following_count }),
      () => ({ username: data.user?.username, isPrivate: data.user?.is_private, followingCount: data.user?.following_count }),
      () => ({ username: data.data?.user?.username, isPrivate: data.data?.user?.is_private, followingCount: data.data?.user?.edge_follow?.count }),
      // Handle simple following_count under data.user
      () => ({ username: data.data?.user?.username, isPrivate: data.data?.user?.is_private, followingCount: data.data?.user?.following_count }),
      // Handle edge_follow_count variant
      () => ({ username: data.data?.user?.username, isPrivate: data.data?.user?.is_private, followingCount: data.data?.user?.edge_follow_count }),
      () => ({ username: data.graphql?.user?.username, isPrivate: data.graphql?.user?.is_private, followingCount: data.graphql?.user?.edge_follow?.count }),
      () => ({ username: data.profile?.username, isPrivate: data.profile?.is_private, followingCount: data.profile?.following_count })
    ];

    for (const getter of candidates) {
      try {
        const p = getter();
        if (p && p.username) {
          return {
            username: p.username || fallbackUsername,
            isPrivate: !!p.isPrivate,
            followingCount: Number(p.followingCount || 0)
          };
        }
      } catch (_) {
        // ignore and continue
      }
    }

    // If data looks like a simple array/object with username field
    if (data.username) {
      return { username: data.username, isPrivate: !!data.is_private, followingCount: Number(data.following_count || 0) };
    }

    return null;
  }

  private parseFollowingShape(data: any): string[] {
    if (!data) return [];

    // Common response patterns from RapidAPI Instagram scrapers
    
    // Pattern 1: Direct array of user objects
    if (Array.isArray(data)) {
      return data.map((u: any) => u.username || u.user?.username).filter(Boolean);
    }

    // Pattern 2: data.users array 
    if (Array.isArray(data.users)) {
      return data.users.map((u: any) => u.username || u.user?.username).filter(Boolean);
    }

    // Pattern 3: data.data.users array
    if (Array.isArray(data.data?.users)) {
      return data.data.users.map((u: any) => u.username || u.user?.username).filter(Boolean);
    }

    // Pattern 3b: data.data.user.edge_follow.edges (GraphQL style from initial profile)
    const edgeFollowEdges = data.data?.user?.edge_follow?.edges;
    if (Array.isArray(edgeFollowEdges)) {
      return edgeFollowEdges.map((e: any) => e.node?.username).filter(Boolean);
    }
    
    // Pattern 3c: data.profile.edge_follow.edges (alternate GraphQL path)
    const profileEdgeFollow = data.profile?.edge_follow?.edges;
    if (Array.isArray(profileEdgeFollow)) {
      return profileEdgeFollow.map((e: any) => e.node?.username).filter(Boolean);
    }
    
    // Pattern 3d: data.user.edge_follow.edges (alternate GraphQL path)
    const userEdgeFollow = data.user?.edge_follow?.edges;
    if (Array.isArray(userEdgeFollow)) {
      return userEdgeFollow.map((e: any) => e.node?.username).filter(Boolean);
    }

    // Pattern 4: edges structure (GraphQL style)
    if (Array.isArray(data.edges)) {
      return data.edges.map((e: any) => e.node?.username || e.username).filter(Boolean);
    }

    // Pattern 5: graphql.user.edge_follow.edges
    const graphqlEdges = data?.graphql?.user?.edge_follow?.edges;
    if (Array.isArray(graphqlEdges)) {
      return graphqlEdges.map((e: any) => e.node?.username).filter(Boolean);
    }

    // Pattern 6: data.following array (direct following list)
    if (Array.isArray(data.following)) {
      return data.following.map((u: any) => u.username || u.user?.username || u).filter(Boolean);
    }

    // Pattern 7: items array (common pagination pattern)
    if (Array.isArray(data.items)) {
      return data.items.map((u: any) => u.username || u.user?.username).filter(Boolean);
    }

    // Pattern 8: response.users or response.data
    if (data.response?.users && Array.isArray(data.response.users)) {
      return data.response.users.map((u: any) => u.username || u.user?.username).filter(Boolean);
    }

    // If it's an object with no clear array, check if it has pagination info
    if (data.end_cursor || data.has_next_page || data.page_info) {
      console.log('Response appears to be paginated but no users found in this page');
    }

    console.log('No recognizable following list structure found in response');
    return [];
  }

  /**
   * Validate profile existence; forceRefresh for fresh API call
   */
  async validateProfile(username: string, forceRefresh: boolean = false): Promise<{ isValid: boolean; reason?: string; profile?: InstagramProfile }> {
    const profile = await this.getProfile(username, forceRefresh);
    // Always valid in free-tier
    return { isValid: true, profile };
  }
  
}