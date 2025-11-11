import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { APIKeyManager } from "@/lib/security";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";

/**
 * API Key Management
 *
 * Allows manufacturers to create and manage API keys for programmatic access
 */

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  rateLimit: z.number().int().min(100).max(10000).default(1000),
  expiresAt: z.string().datetime().optional(),
});

/**
 * Create new API key
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, subscriptionTier: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Only manufacturers can create API keys
    if (user.subscriptionTier !== "manufacturer" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Manufacturer subscription required" },
        { status: 403 }
      );
    }

    // Check API key limit (5 keys per manufacturer)
    const keyCount = await prisma.aPIKey.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (keyCount >= 5) {
      return NextResponse.json(
        {
          error: "API key limit reached",
          limit: 5,
          current: keyCount,
        },
        { status: 403 }
      );
    }

    // Parse and validate request
    const body = await req.json();
    const { name, scopes, rateLimit, expiresAt } = createKeySchema.parse(body);

    // Validate scopes
    const validScopes = [
      "manual:read",
      "manual:write",
      "manual:delete",
      "session:read",
      "session:write",
      "analytics:read",
    ];

    const invalidScopes = scopes.filter((scope) => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid scopes",
          invalidScopes,
          validScopes,
        },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = APIKeyManager.generate();
    const keyHash = APIKeyManager.hash(apiKey);
    const prefix = apiKey.substring(0, 12); // Show first 12 chars

    // Create key record
    const keyRecord = await prisma.aPIKey.create({
      data: {
        userId: user.id,
        name,
        keyHash,
        prefix,
        scopes: scopes,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    });

    // Log audit event
    await AuditLogger.log({
      eventType: AuditEventType.API_KEY_CREATED,
      severity: "INFO",
      userId: user.id,
      resourceType: "api_key",
      resourceId: keyRecord.id,
      action: "create",
      description: `Created API key: ${name}`,
      metadata: {
        scopes,
        rateLimit,
      },
      success: true,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "API key created successfully. Store it securely - you won't be able to see it again.",
      apiKey, // Only shown once
      key: {
        id: keyRecord.id,
        name: keyRecord.name,
        prefix: keyRecord.prefix,
        scopes: keyRecord.scopes,
        rateLimit: keyRecord.rateLimit,
        expiresAt: keyRecord.expiresAt,
        createdAt: keyRecord.createdAt,
      },
    });
  } catch (error) {
    console.error("Create API key error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

/**
 * List user's API keys
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, subscriptionTier: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Only manufacturers can view API keys
    if (user.subscriptionTier !== "manufacturer" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Manufacturer subscription required" },
        { status: 403 }
      );
    }

    // Get user's API keys
    const keys = await prisma.aPIKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        rateLimit: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      keys,
      limit: 5,
      current: keys.filter((k) => k.isActive).length,
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}
