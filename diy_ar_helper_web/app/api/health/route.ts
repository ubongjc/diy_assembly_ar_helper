import { NextResponse } from "next/server";

/**
 * Health check endpoint
 * @returns Health status with timestamp and version
 */
export async function GET() {
  try {
    // Basic health check - can be extended to check DB, cache, etc.
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
