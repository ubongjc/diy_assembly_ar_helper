import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export interface UserWithPermissions {
  id: string;
  email: string | null;
  clerkId: string;
  role: Role;
  permissions: Record<string, any> | null;
  subscriptionTier: string | null;
}

/**
 * Get the current authenticated user with permissions
 */
export async function getCurrentUser(): Promise<UserWithPermissions | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      email: true,
      clerkId: true,
      role: true,
      permissions: true,
      subscriptionTier: true,
    },
  });

  return user;
}

/**
 * Check if user has required role
 */
export function hasRole(user: UserWithPermissions, requiredRole: Role): boolean {
  const roleHierarchy = {
    [Role.USER]: 0,
    [Role.PRO]: 1,
    [Role.MANUFACTURER]: 2,
    [Role.ADMIN]: 3,
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * Check if user has specific permission (ABAC)
 */
export function hasPermission(
  user: UserWithPermissions,
  resource: string,
  action: string
): boolean {
  // Admin has all permissions
  if (user.role === Role.ADMIN) {
    return true;
  }

  // Check ABAC permissions
  const permissions = user.permissions as Record<string, string[]> | null;
  if (!permissions) {
    return false;
  }

  return permissions[resource]?.includes(action) ?? false;
}

/**
 * Check if user has active Pro subscription
 */
export async function hasProSubscription(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  return user?.subscriptionTier === "pro" || user?.subscriptionTier === "manufacturer";
}

/**
 * Sync Clerk user to database
 */
export async function syncUserToDatabase(
  clerkId: string,
  email: string | null,
  name: string | null
) {
  return await prisma.user.upsert({
    where: { clerkId },
    update: { email, name },
    create: {
      clerkId,
      email,
      name,
      role: Role.USER,
    },
  });
}
