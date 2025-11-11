import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client
// For local development, you can use an in-memory store
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Create a new ratelimiter that allows 10 requests per 10 seconds
export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "@upstash/ratelimit",
    })
  : null;

// Stricter rate limit for sensitive endpoints (auth, payments)
export const strictRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/strict",
    })
  : null;

// Very strict rate limit for expensive operations (file uploads, AI processing)
export const expensiveRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "300 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/expensive",
    })
  : null;

/**
 * In-memory fallback rate limiter for development
 * DO NOT use in production
 */
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  limit = 10,
  window = 10000
): Promise<{ success: boolean; remaining: number }> {
  // Use Upstash if available
  if (ratelimit) {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  }

  // Fallback to in-memory store for development
  const now = Date.now();
  const key = identifier;
  const existing = inMemoryStore.get(key);

  if (!existing || existing.resetAt < now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + window });
    return { success: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0 };
  }

  existing.count++;
  return { success: true, remaining: limit - existing.count };
}

/**
 * Get rate limit identifier from request
 * Uses IP address, user ID if authenticated, or API key
 */
export function getRateLimitIdentifier(
  req: Request,
  userId?: string
): string {
  // Use user ID if authenticated (best option)
  if (userId) {
    return `user:${userId}`;
  }

  // Use API key if provided (for manufacturer integrations)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    return `api-key:${apiKey}`;
  }

  // Fall back to IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0] || "unknown";
  return `ip:${ip}`;
}
