import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { InputSanitizer } from "@/lib/security";

/**
 * Manual Review API
 *
 * Create, update, delete, and list reviews for manuals
 */

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

/**
 * Create review
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
      select: { id: true, userId: true, isPublic: true },
    });

    if (!manual) {
      return NextResponse.json(
        { error: "Manual not found" },
        { status: 404 }
      );
    }

    // Prevent reviewing own manual
    if (manual.userId === user.id) {
      return NextResponse.json(
        { error: "Cannot review your own manual" },
        { status: 400 }
      );
    }

    // Check if user already reviewed this manual
    const existingReview = await prisma.manualReview.findFirst({
      where: {
        userId: user.id,
        manualId,
      },
    });

    if (existingReview) {
      return NextResponse.json(
        { error: "You already reviewed this manual" },
        { status: 400 }
      );
    }

    // Parse and validate review data
    const body = await req.json();
    const { rating, comment } = reviewSchema.parse(body);

    // Sanitize comment
    const sanitizedComment = InputSanitizer.sanitizeHTML(comment);

    // Create review
    const review = await prisma.manualReview.create({
      data: {
        userId: user.id,
        manualId,
        rating,
        comment: sanitizedComment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Create review error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid review data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}

/**
 * Get reviews for manual
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const manualId = params.id;

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Get reviews with pagination
    const [reviews, totalCount, stats] = await Promise.all([
      prisma.manualReview.findMany({
        where: {
          manualId,
          reported: false,
        },
        skip,
        take: limit,
        orderBy: [
          { helpful: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.manualReview.count({
        where: {
          manualId,
          reported: false,
        },
      }),
      prisma.manualReview.aggregate({
        where: {
          manualId,
          reported: false,
        },
        _avg: {
          rating: true,
        },
        _count: {
          rating: true,
        },
      }),
    ]);

    // Calculate rating distribution
    const ratingDistribution = await prisma.manualReview.groupBy({
      by: ["rating"],
      where: {
        manualId,
        reported: false,
      },
      _count: true,
    });

    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      distribution[i] = 0;
    }
    ratingDistribution.forEach((item) => {
      distribution[item.rating] = item._count;
    });

    return NextResponse.json({
      success: true,
      reviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        averageRating: stats._avg.rating || 0,
        totalReviews: stats._count.rating,
        distribution,
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

/**
 * Update review (vote helpful or report)
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
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { reviewId, action } = body;

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: "Review ID and action required" },
        { status: 400 }
      );
    }

    const review = await prisma.manualReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    // Handle different actions
    if (action === "helpful") {
      // Increment helpful count
      const updated = await prisma.manualReview.update({
        where: { id: reviewId },
        data: {
          helpful: {
            increment: 1,
          },
        },
      });

      return NextResponse.json({
        success: true,
        review: updated,
      });
    } else if (action === "report") {
      // Mark as reported (admin review required)
      const updated = await prisma.manualReview.update({
        where: { id: reviewId },
        data: {
          reported: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Review reported for moderation",
      });
    } else if (action === "delete") {
      // Only owner or admin can delete
      if (review.userId !== user.id && user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }

      await prisma.manualReview.delete({
        where: { id: reviewId },
      });

      return NextResponse.json({
        success: true,
        message: "Review deleted",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update review error:", error);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 }
    );
  }
}
