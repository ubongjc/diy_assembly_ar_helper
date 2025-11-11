import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Validation schema for manual ingestion
const ManualIngestSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  category: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  steps: z.array(
    z.object({
      order: z.number(),
      title: z.string(),
      description: z.string(),
      imageUrl: z.string().url().optional(),
      estimatedTime: z.number().optional(),
      warnings: z.array(z.string()).optional(),
      partsUsed: z.array(z.string()).optional(),
    })
  ),
  partsRequired: z.array(z.string()).optional(),
  toolsRequired: z.array(z.string()).optional(),
  estimatedTime: z.number().optional(),
  difficultyLevel: z.enum(["easy", "medium", "hard"]).optional(),
  isPublic: z.boolean().default(false),
  isPro: z.boolean().default(false),
  imageUrls: z.array(z.string().url()).optional(),
});

/**
 * POST /api/manual/ingest
 * Ingest a new manual from scanned data or user input
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    // Validate request body
    const validatedData = ManualIngestSchema.parse(body);

    // Create manual in database
    const manual = await prisma.manual.create({
      data: {
        userId: user.id,
        brand: validatedData.brand,
        model: validatedData.model,
        category: validatedData.category,
        title: validatedData.title,
        description: validatedData.description,
        steps: validatedData.steps,
        partsRequired: validatedData.partsRequired || [],
        toolsRequired: validatedData.toolsRequired || [],
        estimatedTime: validatedData.estimatedTime,
        difficultyLevel: validatedData.difficultyLevel,
        isPublic: validatedData.isPublic,
        isPro: validatedData.isPro,
        imageUrls: validatedData.imageUrls || [],
      },
    });

    return NextResponse.json(
      {
        success: true,
        manual: {
          id: manual.id,
          brand: manual.brand,
          model: manual.model,
          title: manual.title,
          createdAt: manual.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Manual ingestion error:", error);
    return NextResponse.json(
      { error: "Failed to ingest manual" },
      { status: 500 }
    );
  }
}
