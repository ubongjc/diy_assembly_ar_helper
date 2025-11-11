import { prisma } from "@/lib/prisma";

/**
 * Notification Helper
 *
 * Utility functions for creating and sending notifications
 */

export enum NotificationType {
  PAYMENT = "payment",
  SECURITY = "security",
  FEATURE = "feature",
  MANUAL = "manual",
  SESSION = "session",
  REVIEW = "review",
  ADMIN = "admin",
}

export interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Send notification to user
 */
export async function sendNotification(data: NotificationData): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
    // Don't throw - notifications shouldn't break the app
  }
}

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkNotifications(
  userIds: string[],
  notification: Omit<NotificationData, "userId">
): Promise<void> {
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link || null,
      })),
    });
  } catch (error) {
    console.error("Failed to send bulk notifications:", error);
  }
}

/**
 * Predefined notification templates
 */
export const NotificationTemplates = {
  /**
   * Payment successful
   */
  paymentSuccess: (userId: string, amount: string): NotificationData => ({
    userId,
    type: NotificationType.PAYMENT,
    title: "Payment Successful",
    message: `Your payment of ${amount} was processed successfully.`,
    link: "/dashboard/billing",
  }),

  /**
   * Payment failed
   */
  paymentFailed: (userId: string, amount: string): NotificationData => ({
    userId,
    type: NotificationType.PAYMENT,
    title: "Payment Failed",
    message: `Your payment of ${amount} failed. Please update your payment method.`,
    link: "/dashboard/billing",
  }),

  /**
   * Subscription expiring soon
   */
  subscriptionExpiring: (userId: string, daysLeft: number): NotificationData => ({
    userId,
    type: NotificationType.PAYMENT,
    title: "Subscription Expiring Soon",
    message: `Your subscription will expire in ${daysLeft} days. Renew now to keep access to Pro features.`,
    link: "/dashboard/subscription",
  }),

  /**
   * Manual published
   */
  manualPublished: (userId: string, manualTitle: string, manualId: string): NotificationData => ({
    userId,
    type: NotificationType.MANUAL,
    title: "Manual Published",
    message: `Your manual "${manualTitle}" is now live!`,
    link: `/manual/${manualId}`,
  }),

  /**
   * Session completed
   */
  sessionCompleted: (userId: string, manualTitle: string): NotificationData => ({
    userId,
    type: NotificationType.SESSION,
    title: "Assembly Completed!",
    message: `Congratulations on completing "${manualTitle}"!`,
  }),

  /**
   * New review on manual
   */
  newReview: (userId: string, manualTitle: string, rating: number, manualId: string): NotificationData => ({
    userId,
    type: NotificationType.REVIEW,
    title: "New Review on Your Manual",
    message: `Someone rated "${manualTitle}" ${rating} stars!`,
    link: `/manual/${manualId}`,
  }),

  /**
   * Security alert
   */
  securityAlert: (userId: string, message: string): NotificationData => ({
    userId,
    type: NotificationType.SECURITY,
    title: "Security Alert",
    message,
    link: "/dashboard/security",
  }),

  /**
   * New feature announcement
   */
  newFeature: (userId: string, featureName: string, description: string): NotificationData => ({
    userId,
    type: NotificationType.FEATURE,
    title: `New Feature: ${featureName}`,
    message: description,
  }),

  /**
   * Admin message
   */
  adminMessage: (userId: string, title: string, message: string): NotificationData => ({
    userId,
    type: NotificationType.ADMIN,
    title,
    message,
  }),
};

/**
 * Get unread count for user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Mark all notifications as read for user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(daysOld: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
      isRead: true,
    },
  });

  return result.count;
}
