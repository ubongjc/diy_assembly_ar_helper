import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { setSecurityHeaders, CSRFProtection } from "@/lib/security";
import { getRateLimitIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { AuditLogger, AuditEventType, AuditSeverity } from "@/lib/audit-log";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/api/webhook(.*)",
  "/",
]);

// Define rate-limited routes
const isRateLimitedRoute = createRouteMatcher([
  "/api/(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Create response (will be modified)
  let response = NextResponse.next();

  // Apply security headers to all responses
  response = setSecurityHeaders(response);

  // Generate and set CSRF token for GET requests
  if (request.method === "GET" && !request.nextUrl.pathname.startsWith("/api/webhook")) {
    let token = CSRFProtection.getToken(request);
    if (!token) {
      token = CSRFProtection.generateToken();
      CSRFProtection.setToken(response, token);
    }
  }

  // Verify CSRF token for state-changing requests
  if (!request.nextUrl.pathname.startsWith("/api/webhook")) {
    const csrfValid = CSRFProtection.verify(request);
    if (!csrfValid && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      // Log security event
      await AuditLogger.logSecurity({
        eventType: AuditEventType.SECURITY_CSRF_FAILED,
        description: "CSRF token validation failed",
        request,
        metadata: {
          path: request.nextUrl.pathname,
          method: request.method,
        },
      });

      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }
  }

  // Apply rate limiting to API routes
  if (isRateLimitedRoute(request)) {
    const { userId } = await auth();
    const identifier = getRateLimitIdentifier(request, userId || undefined);

    const rateLimit = await checkRateLimit(identifier);

    if (!rateLimit.success) {
      // Log rate limit exceeded
      await AuditLogger.logSecurity({
        eventType: AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
        userId: userId || undefined,
        description: "Rate limit exceeded",
        request,
        metadata: {
          identifier,
          path: request.nextUrl.pathname,
        },
      });

      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: rateLimit.reset
            ? Math.ceil((rateLimit.reset - Date.now()) / 1000)
            : 60,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.reset
              ? Math.ceil((rateLimit.reset - Date.now()) / 1000).toString()
              : "60",
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.reset?.toString() || "",
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", "10");
    response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
    if (rateLimit.reset) {
      response.headers.set("X-RateLimit-Reset", rateLimit.reset.toString());
    }
  }

  // Check authentication for protected routes
  if (!isPublicRoute(request)) {
    try {
      await auth.protect();
    } catch (error) {
      // Log failed authentication attempt
      await AuditLogger.logAuth({
        eventType: AuditEventType.AUTH_FAILED,
        success: false,
        request,
        description: "Authentication required",
        metadata: {
          path: request.nextUrl.pathname,
        },
      });
      throw error;
    }
  }

  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
