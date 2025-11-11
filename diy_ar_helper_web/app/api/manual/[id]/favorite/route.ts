import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Favorite/Unfavorite Manual API
 */

export async function POST(
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

    const manualId = params.id;

    // Check if manual exists
    const manual = await prisma.manual.findUnique({
      where: { id: manualId },
      select: { id: true, isPublic: true },
    });

    if (!manual) {
      return NextResponse.json(
        { error: "Manual not found" },
        { status: 404 }
      );
    }

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_manualId: {
          userId: user.id,
          manualId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Manual already favorited" },
        { status: 400 }
      );
    }

    // Create favorite
    const favorite = await prisma.favorite.create({
      data: {
        userId: user.id,
        manualId,
      },
    });

    return NextResponse.json({
      success: true,
      favorite,
    });
  } catch (error) {
    console.error("Favorite error:", error);
    return NextResponse.json(
      { error: "Failed to favorite manual" },
      { status: 500 }
    );
  }
}

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

    const manualId = params.id;

    // Delete favorite
    await prisma.favorite.delete({
      where: {
        userId_manualId: {
          userId: user.id,
          manualId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Manual unfavorited",
    });
  } catch (error) {
    console.error("Unfavorite error:", error);
    return NextResponse.json(
      { error: "Failed to unfavorite manual" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ isFavorited: false });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ isFavorited: false });
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_manualId: {
          userId: user.id,
          manualId: params.id,
        },
      },
    });

    return NextResponse.json({
      isFavorited: !!favorite,
      favorite: favorite || null,
    });
  } catch (error) {
    console.error("Check favorite error:", error);
    return NextResponse.json({ isFavorited: false });
  }
}
