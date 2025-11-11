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

// Cleanup old entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of inMemoryStore.entries()) {
      if (value.resetAt < now) {
        inMemoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export async function checkRateLimit(
  identifier: string,
  limit = 10,
  window = 10000
): Promise<{ success: boolean; remaining: number; reset?: number }> {
  // Use Upstash if available
  if (ratelimit) {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // Fallback to in-memory store for development
  const now = Date.now();
  const key = identifier;
  const existing = inMemoryStore.get(key);

  if (!existing || existing.resetAt < now) {
    const resetAt = now + window;
    inMemoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, reset: resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, reset: existing.resetAt };
  }

  existing.count++;
  return {
    success: true,
    remaining: limit - existing.count,
    reset: existing.resetAt,
  };
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
    // Sanitize API key to prevent injection attacks
    const sanitizedKey = apiKey.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, "");
    return `api-key:${sanitizedKey}`;
  }

  // Fall back to IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  // Prefer x-real-ip, then first IP from x-forwarded-for
  let ip = realIp || (forwardedFor?.split(",")[0]?.trim());

  // Sanitize IP address
  if (ip) {
    // Allow IPv4 and IPv6
    ip = ip.replace(/[^0-9a-fA-F:.]/g, "").substring(0, 45);
  }

  return `ip:${ip || "unknown"}`;
}
