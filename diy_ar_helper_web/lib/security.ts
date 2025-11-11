import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Security headers for all responses
 * Implements OWASP security best practices
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.com https://cdn.jsdelivr.net", // Clerk requires unsafe-inline
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://clerk.com https://*.clerk.accounts.dev https://api.stripe.com https://*.r2.dev https://*.sentry.io",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Enable XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  const permissions = [
    "camera=(self)",
    "microphone=()",
    "geolocation=()",
    "payment=(self)",
    "usb=()",
  ].join(", ");
  response.headers.set("Permissions-Policy", permissions);

  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

/**
 * CSRF Token Management
 * Double Submit Cookie pattern
 */
export class CSRFProtection {
  private static TOKEN_LENGTH = 32;
  private static COOKIE_NAME = "csrf-token";
  private static HEADER_NAME = "x-csrf-token";

  /**
   * Generate a new CSRF token
   */
  static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString("hex");
  }

  /**
   * Set CSRF token in cookie
   */
  static setToken(response: NextResponse, token: string): void {
    response.cookies.set(this.COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
  }

  /**
   * Verify CSRF token
   */
  static verify(request: NextRequest): boolean {
    // Only check for state-changing methods
    const method = request.method;
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return true;
    }

    const cookieToken = request.cookies.get(this.COOKIE_NAME)?.value;
    const headerToken = request.headers.get(this.HEADER_NAME);

    if (!cookieToken || !headerToken) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  }

  /**
   * Get token from request
   */
  static getToken(request: NextRequest): string | null {
    return request.cookies.get(this.COOKIE_NAME)?.value || null;
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, "") // Remove event handlers
      .trim();
  }

  /**
   * Sanitize HTML input
   * Use DOMPurify on client side for rich text
   */
  static sanitizeHTML(input: string): string {
    // Basic server-side sanitization
    // For rich text, use DOMPurify on client side
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "");
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   */
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace special chars with underscore
      .replace(/\.{2,}/g, ".") // Remove directory traversal attempts
      .substring(0, 255); // Limit length
  }
}

/**
 * API Key Management
 */
export class APIKeyManager {
  private static PREFIX = "diy_";

  /**
   * Generate a new API key
   */
  static generate(): string {
    const key = crypto.randomBytes(32).toString("hex");
    return `${this.PREFIX}${key}`;
  }

  /**
   * Hash API key for storage
   */
  static hash(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  /**
   * Verify API key format
   */
  static isValid(apiKey: string): boolean {
    return (
      apiKey.startsWith(this.PREFIX) &&
      apiKey.length === this.PREFIX.length + 64
    );
  }
}

/**
 * Password utilities (for magic link fallback)
 */
export class PasswordUtils {
  /**
   * Generate a secure random password
   */
  static generate(length = 16): string {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const values = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[values[i] % charset.length];
    }
    return password;
  }

  /**
   * Validate password strength
   */
  static validateStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push("Password must be at least 12 characters long");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain lowercase letters");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain uppercase letters");
    }

    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain numbers");
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain special characters");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Session security utilities
 */
export class SessionSecurity {
  /**
   * Generate secure session token
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Calculate session fingerprint
   * Used to detect session hijacking
   */
  static calculateFingerprint(request: NextRequest): string {
    const userAgent = request.headers.get("user-agent") || "";
    const acceptLanguage = request.headers.get("accept-language") || "";
    const acceptEncoding = request.headers.get("accept-encoding") || "";

    const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    return crypto.createHash("sha256").update(fingerprint).digest("hex");
  }

  /**
   * Verify session fingerprint
   */
  static verifyFingerprint(
    request: NextRequest,
    storedFingerprint: string
  ): boolean {
    const currentFingerprint = this.calculateFingerprint(request);
    return crypto.timingSafeEqual(
      Buffer.from(currentFingerprint),
      Buffer.from(storedFingerprint)
    );
  }
}
