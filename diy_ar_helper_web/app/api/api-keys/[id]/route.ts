import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";

/**
 * API Key Update/Revoke
 */

/**
 * Get API key details
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

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
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

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (apiKey.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      key: apiKey,
    });
  } catch (error) {
    console.error("Get API key error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API key" },
      { status: 500 }
    );
  }
}

/**
 * Update API key (activate/deactivate)
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

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: params.id },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (apiKey.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { isActive, name } = body;

    // Update key
    const updated = await prisma.aPIKey.update({
      where: { id: params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(name && { name }),
      },
    });

    // Log audit event
    await AuditLogger.log({
      eventType: AuditEventType.API_KEY_REVOKED,
      severity: "WARNING",
      userId: user.id,
      resourceType: "api_key",
      resourceId: params.id,
      action: isActive ? "activate" : "deactivate",
      description: `${isActive ? "Activated" : "Deactivated"} API key: ${apiKey.name}`,
      success: true,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      key: updated,
    });
  } catch (error) {
    console.error("Update API key error:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

/**
 * Revoke (delete) API key
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

    const apiKey = await prisma.aPIKey.findUnique({
      where: { id: params.id },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (apiKey.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete key
    await prisma.aPIKey.delete({
      where: { id: params.id },
    });

    // Log audit event
    await AuditLogger.log({
      eventType: AuditEventType.API_KEY_REVOKED,
      severity: "WARNING",
      userId: user.id,
      resourceType: "api_key",
      resourceId: params.id,
      action: "revoke",
      description: `Revoked API key: ${apiKey.name}`,
      success: true,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
