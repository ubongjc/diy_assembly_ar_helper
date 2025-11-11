import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";

/**
 * Session Management API
 *
 * Tracks user progress through assembly manuals:
 * - Create new session
 * - Update progress
 * - Mark steps complete
 * - Complete/abandon session
 * - Get session history
 */

// Create session schema
const createSessionSchema = z.object({
  manualId: z.string().cuid(),
  deviceType: z.enum(["ios", "web"]).default("web"),
});

// Update session schema
const updateSessionSchema = z.object({
  currentStep: z.number().int().nonnegative().optional(),
  stepStates: z.array(z.enum(["pending", "in_progress", "completed", "skipped"])).optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "PAUSED", "ABANDONED"]).optional(),
  arData: z.record(z.any()).optional(),
  telemetry: z.record(z.any()).optional(),
});

/**
 * Create new session
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
      select: { id: true, subscriptionTier: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { manualId, deviceType } = createSessionSchema.parse(body);

    // Check if manual exists and user has access
    const manual = await prisma.manual.findUnique({
      where: { id: manualId },
      select: {
        id: true,
        userId: true,
        isPublic: true,
        isPro: true,
        steps: true,
        title: true,
      },
    });

    if (!manual) {
      return NextResponse.json(
        { error: "Manual not found" },
        { status: 404 }
      );
    }

    // Check access permissions
    const isOwner = manual.userId === user.id;
    const hasProAccess = user.subscriptionTier === "pro" || user.subscriptionTier === "manufacturer";

    if (!manual.isPublic && !isOwner) {
      return NextResponse.json(
        { error: "Manual is private" },
        { status: 403 }
      );
    }

    if (manual.isPro && !hasProAccess && !isOwner) {
      return NextResponse.json(
        { error: "Pro subscription required" },
        { status: 403 }
      );
    }

    // Check if there's already an active session for this manual
    const existingSession = await prisma.session.findFirst({
      where: {
        userId: user.id,
        manualId,
        status: { in: ["IN_PROGRESS", "PAUSED"] },
      },
    });

    if (existingSession) {
      // Return existing session instead of creating new one
      return NextResponse.json({
        success: true,
        session: existingSession,
        resumed: true,
      });
    }

    // Initialize step states
    const steps = (manual.steps as any[]) || [];
    const stepStates = steps.map(() => "pending");

    // Create new session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        manualId,
        currentStep: 0,
        stepStates,
        status: "IN_PROGRESS",
        deviceType,
        arData: {},
        telemetry: {
          startedAt: new Date().toISOString(),
        },
      },
    });

    // Log audit event
    await AuditLogger.log({
      eventType: AuditEventType.SESSION_STARTED,
      severity: "INFO",
      userId: user.id,
      resourceType: "session",
      resourceId: session.id,
      action: "start",
      description: `Started session for manual: ${manual.title}`,
      metadata: {
        manualId,
        deviceType,
      },
      success: true,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      session,
      resumed: false,
    });
  } catch (error) {
    console.error("Create session error:", error);

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
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

/**
 * Get user's sessions
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
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") as any;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    // Get sessions with manual info
    const [sessions, totalCount] = await Promise.all([
      prisma.session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          manual: {
            select: {
              id: true,
              brand: true,
              model: true,
              title: true,
              category: true,
              difficultyLevel: true,
              estimatedTime: true,
              imageUrls: true,
            },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
