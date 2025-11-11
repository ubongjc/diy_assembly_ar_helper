import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";

/**
 * Manual Search API
 *
 * Supports:
 * - Full-text search
 * - Category filtering
 * - Difficulty filtering
 * - Public/Pro filtering
 * - Brand/model filtering
 * - Pagination
 * - Sorting
 */

// Search request validation schema
const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  brand: z.string().optional(),
  isPublic: z.boolean().optional(),
  isPro: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "estimatedTime"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const rawParams = {
      query: searchParams.get("query") || undefined,
      category: searchParams.get("category") || undefined,
      difficulty: searchParams.get("difficulty") || undefined,
      brand: searchParams.get("brand") || undefined,
      isPublic: searchParams.get("isPublic") === "true" ? true : searchParams.get("isPublic") === "false" ? false : undefined,
      isPro: searchParams.get("isPro") === "true" ? true : searchParams.get("isPro") === "false" ? false : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    };

    // Validate parameters
    const validatedParams = searchSchema.parse(rawParams);
    const { query, category, difficulty, brand, isPublic, isPro, page, limit, sortBy, sortOrder } = validatedParams;

    // Build where clause
    const where: any = {};

    // Full-text search on title, brand, model, category
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { model: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (category) {
      where.category = { equals: category, mode: "insensitive" };
    }

    // Difficulty filter
    if (difficulty) {
      where.difficultyLevel = difficulty;
    }

    // Brand filter
    if (brand) {
      where.brand = { equals: brand, mode: "insensitive" };
    }

    // Public filter
    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    // Pro filter
    if (isPro !== undefined) {
      where.isPro = isPro;
    }

    // Access control: If user is not authenticated, only show public manuals
    if (!userId) {
      where.isPublic = true;
      where.isPro = false;
    } else {
      // If authenticated, show:
      // - Public manuals
      // - User's own manuals
      // - Pro manuals if user has Pro subscription
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

      // Build access control filter
      const accessFilter: any = {
        OR: [
          { isPublic: true, isPro: false }, // Public free manuals
          { userId: user.id }, // User's own manuals
        ],
      };

      // If user has Pro or Manufacturer subscription, include Pro manuals
      if (user.subscriptionTier === "pro" || user.subscriptionTier === "manufacturer") {
        accessFilter.OR.push({ isPro: true });
      }

      // Merge access control with existing where clause
      if (Object.keys(where).length > 0) {
        // Wrap existing filters and access control properly
        const existingFilters = { ...where };
        where = {
          AND: [
            existingFilters,
            accessFilter,
          ],
        };
      } else {
        Object.assign(where, accessFilter);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [manuals, totalCount] = await Promise.all([
      prisma.manual.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          userId: true,
          brand: true,
          model: true,
          category: true,
          title: true,
          description: true,
          estimatedTime: true,
          difficultyLevel: true,
          isPublic: true,
          isPro: true,
          imageUrls: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          // Aggregate stats
          _count: {
            select: {
              sessions: true,
              reviews: true,
              favorites: true,
            },
          },
        },
      }),
      prisma.manual.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Log search analytics
    try {
      await prisma.searchAnalytics.create({
        data: {
          userId: userId || null,
          query: query || "",
          filters: {
            category,
            difficulty,
            brand,
            isPublic,
            isPro,
          },
          resultsCount: totalCount,
        },
      });
    } catch (error) {
      // Don't fail the request if analytics fails
      console.error("Failed to log search analytics:", error);
    }

    return NextResponse.json({
      success: true,
      data: manuals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      filters: {
        query,
        category,
        difficulty,
        brand,
        isPublic,
        isPro,
      },
    });
  } catch (error) {
    console.error("Search error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid search parameters",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Log error for monitoring
    await AuditLogger.logSecurity({
      eventType: AuditEventType.API_REQUEST_FAILED,
      description: "Manual search failed",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        path: req.nextUrl.pathname,
      },
    });

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

/**
 * Get available filter options (categories, brands, etc.)
 */
export async function OPTIONS(req: NextRequest) {
  try {
    const { userId } = await auth();

    // Get unique categories
    const categories = await prisma.manual.findMany({
      where: userId ? {} : { isPublic: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    // Get unique brands
    const brands = await prisma.manual.findMany({
      where: userId ? {} : { isPublic: true },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });

    // Get stats
    const stats = await prisma.manual.aggregate({
      where: userId ? {} : { isPublic: true },
      _count: true,
      _avg: {
        estimatedTime: true,
      },
    });

    return NextResponse.json({
      success: true,
      filters: {
        categories: categories.map((c) => c.category),
        brands: brands.map((b) => b.brand),
        difficulties: ["easy", "medium", "hard"],
      },
      stats: {
        totalManuals: stats._count,
        avgEstimatedTime: Math.round(stats._avg.estimatedTime || 0),
      },
    });
  } catch (error) {
    console.error("Filter options error:", error);
    return NextResponse.json(
      { error: "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}
