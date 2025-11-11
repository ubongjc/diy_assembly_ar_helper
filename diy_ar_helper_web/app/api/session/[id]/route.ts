import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";

/**
 * Session Update API
 *
 * Update session progress, mark steps complete, finish session
 */

// Update session schema
const updateSessionSchema = z.object({
  currentStep: z.number().int().nonnegative().optional(),
  stepStates: z.array(z.enum(["pending", "in_progress", "completed", "skipped"])).optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "PAUSED", "ABANDONED"]).optional(),
  arData: z.record(z.any()).optional(),
  telemetry: z.record(z.any()).optional(),
});

/**
 * Get session by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        manual: {
          select: {
            id: true,
            brand: true,
            model: true,
            title: true,
            description: true,
            category: true,
            difficultyLevel: true,
            estimatedTime: true,
            steps: true,
            partsRequired: true,
            toolsRequired: true,
            imageUrls: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (session.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

/**
 * Update session progress
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get existing session
    const existingSession = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        manual: {
          select: { title: true },
        },
      },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingSession.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Parse and validate update data
    const body = await req.json();
    const updates = updateSessionSchema.parse(body);

    // Get manual to validate step bounds
    const manual = await prisma.manual.findUnique({
      where: { id: existingSession.manualId },
      select: { steps: true },
    });

    if (!manual) {
      return NextResponse.json(
        { error: "Manual not found" },
        { status: 404 }
      );
    }

    const manualSteps = Array.isArray(manual.steps) ? manual.steps : [];
    const maxStep = manualSteps.length - 1;

    // Prepare update data
    const updateData: any = {};

    if (updates.currentStep !== undefined) {
      // Validate currentStep is within bounds
      if (updates.currentStep < 0 || updates.currentStep > maxStep) {
        return NextResponse.json(
          {
            error: "Invalid currentStep",
            currentStep: updates.currentStep,
            maxStep,
          },
          { status: 400 }
        );
      }
      updateData.currentStep = updates.currentStep;
    }

    if (updates.stepStates !== undefined) {
      // Validate stepStates length matches manual steps
      if (updates.stepStates.length !== manualSteps.length) {
        return NextResponse.json(
          {
            error: "stepStates length must match manual steps",
            provided: updates.stepStates.length,
            expected: manualSteps.length,
          },
          { status: 400 }
        );
      }
      updateData.stepStates = updates.stepStates;
    }

    // Start with existing telemetry or empty object
    let telemetry = { ...(existingSession.telemetry as any) } || {};

    // Merge user-provided telemetry first
    if (updates.telemetry !== undefined) {
      telemetry = {
        ...telemetry,
        ...updates.telemetry,
      };
    }

    // Then apply status-based telemetry updates (should override user data)
    if (updates.status !== undefined) {
      updateData.status = updates.status;

      if (updates.status === "COMPLETED") {
        telemetry.completedAt = new Date().toISOString();
        // Only calculate duration if startedAt exists
        if (telemetry.startedAt) {
          try {
            telemetry.duration = Date.now() - new Date(telemetry.startedAt).getTime();
          } catch (error) {
            console.error("Failed to calculate duration:", error);
          }
        }
      } else if (updates.status === "ABANDONED") {
        telemetry.abandonedAt = new Date().toISOString();
      } else if (updates.status === "PAUSED") {
        telemetry.pausedAt = new Date().toISOString();
      }
    }

    // Set final telemetry
    updateData.telemetry = telemetry;

    if (updates.arData !== undefined) {
      // Merge AR data with existing
      updateData.arData = {
        ...(existingSession.arData as any),
        ...updates.arData,
      };
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id: params.id },
      data: updateData,
      include: {
        manual: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Log audit event for completion/abandonment
    if (updates.status === "COMPLETED") {
      await AuditLogger.log({
        eventType: AuditEventType.SESSION_COMPLETED,
        severity: "INFO",
        userId: user.id,
        resourceType: "session",
        resourceId: params.id,
        action: "complete",
        description: `Completed session for manual: ${existingSession.manual.title}`,
        metadata: {
          manualId: existingSession.manualId,
          duration: (updateData.telemetry as any)?.duration,
        },
        success: true,
        timestamp: new Date(),
      });
    } else if (updates.status === "ABANDONED") {
      await AuditLogger.log({
        eventType: AuditEventType.SESSION_ABANDONED,
        severity: "INFO",
        userId: user.id,
        resourceType: "session",
        resourceId: params.id,
        action: "abandon",
        description: `Abandoned session for manual: ${existingSession.manual.title}`,
        metadata: {
          manualId: existingSession.manualId,
          currentStep: existingSession.currentStep,
        },
        success: true,
        timestamp: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error("Update session error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

/**
 * Delete session
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get existing session
    const existingSession = await prisma.session.findUnique({
      where: { id: params.id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingSession.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete session
    await prisma.session.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
