import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/manual/{id}
 * Retrieve a manual by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    // Public manuals can be accessed by anyone
    const manual = await prisma.manual.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!manual) {
      return NextResponse.json({ error: "Manual not found" }, { status: 404 });
    }

    // Check access permissions
    const user = userId
      ? await prisma.user.findUnique({ where: { clerkId: userId } })
      : null;

    const isOwner = user && manual.userId === user.id;
    const isPublic = manual.isPublic;
    const hasProAccess =
      user && (user.subscriptionTier === "pro" || user.subscriptionTier === "manufacturer");

    // Access control logic
    if (!isPublic && !isOwner) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Pro content requires Pro subscription
    if (manual.isPro && !hasProAccess && !isOwner) {
      return NextResponse.json(
        {
          error: "Pro subscription required",
          upgradeUrl: "/pricing",
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      manual,
    });
  } catch (error) {
    console.error("Manual retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve manual" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/manual/{id}
 * Delete a manual (owner only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check ownership
    const manual = await prisma.manual.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!manual) {
      return NextResponse.json({ error: "Manual not found" }, { status: 404 });
    }

    if (manual.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Delete manual
    await prisma.manual.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Manual deleted successfully",
    });
  } catch (error) {
    console.error("Manual deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete manual" },
      { status: 500 }
    );
  }
}
