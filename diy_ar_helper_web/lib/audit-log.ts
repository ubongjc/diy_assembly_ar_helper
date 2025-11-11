import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * Audit Log Event Types
 */
export enum AuditEventType {
  // Authentication
  AUTH_LOGIN = "auth.login",
  AUTH_LOGOUT = "auth.logout",
  AUTH_REGISTER = "auth.register",
  AUTH_FAILED = "auth.failed",
  AUTH_PASSWORD_RESET = "auth.password_reset",
  AUTH_2FA_ENABLED = "auth.2fa_enabled",
  AUTH_2FA_DISABLED = "auth.2fa_disabled",

  // User Management
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
  USER_ROLE_CHANGED = "user.role_changed",
  USER_PERMISSIONS_CHANGED = "user.permissions_changed",

  // Data Access
  DATA_VIEWED = "data.viewed",
  DATA_EXPORTED = "data.exported",
  DATA_DELETED = "data.deleted",

  // Manual Operations
  MANUAL_CREATED = "manual.created",
  MANUAL_UPDATED = "manual.updated",
  MANUAL_DELETED = "manual.deleted",
  MANUAL_PUBLISHED = "manual.published",
  MANUAL_UNPUBLISHED = "manual.unpublished",

  // Session Operations
  SESSION_STARTED = "session.started",
  SESSION_COMPLETED = "session.completed",
  SESSION_ABANDONED = "session.abandoned",

  // Payment Operations
  PAYMENT_SUCCEEDED = "payment.succeeded",
  PAYMENT_FAILED = "payment.failed",
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_UPDATED = "subscription.updated",
  SUBSCRIPTION_CANCELLED = "subscription.cancelled",
  REFUND_ISSUED = "refund.issued",

  // Security Events
  SECURITY_RATE_LIMIT_EXCEEDED = "security.rate_limit_exceeded",
  SECURITY_INVALID_TOKEN = "security.invalid_token",
  SECURITY_CSRF_FAILED = "security.csrf_failed",
  SECURITY_IP_BLOCKED = "security.ip_blocked",
  SECURITY_SUSPICIOUS_ACTIVITY = "security.suspicious_activity",

  // Admin Operations
  ADMIN_USER_IMPERSONATE = "admin.user_impersonate",
  ADMIN_SETTINGS_CHANGED = "admin.settings_changed",
  ADMIN_FEATURE_FLAG_CHANGED = "admin.feature_flag_changed",

  // API Operations
  API_KEY_CREATED = "api.key_created",
  API_KEY_REVOKED = "api.key_revoked",
  API_REQUEST_FAILED = "api.request_failed",
}

/**
 * Audit Log Severity Levels
 */
export enum AuditSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Audit Logger
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO audit_logs (
          event_type,
          severity,
          user_id,
          resource_type,
          resource_id,
          action,
          description,
          metadata,
          ip_address,
          user_agent,
          success,
          timestamp
        ) VALUES (
          ${entry.eventType},
          ${entry.severity},
          ${entry.userId},
          ${entry.resourceType},
          ${entry.resourceId},
          ${entry.action},
          ${entry.description},
          ${JSON.stringify(entry.metadata || {})},
          ${entry.ipAddress},
          ${entry.userAgent},
          ${entry.success},
          ${entry.timestamp}
        )
      `;

      // For critical events, also log to Sentry
      if (entry.severity === AuditSeverity.CRITICAL) {
        console.error("[AUDIT CRITICAL]", entry);
      }
    } catch (error) {
      // Don't let audit logging failures break the application
      console.error("Failed to write audit log:", error);
    }
  }

  /**
   * Log authentication event
   */
  static async logAuth(params: {
    eventType: AuditEventType;
    userId?: string;
    success: boolean;
    request?: NextRequest;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      severity: params.success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      userId: params.userId,
      action: params.eventType.split(".")[1],
      description: params.description,
      metadata: params.metadata,
      ipAddress: params.request
        ? this.getClientIP(params.request)
        : undefined,
      userAgent: params.request
        ? params.request.headers.get("user-agent") || undefined
        : undefined,
      success: params.success,
      timestamp: new Date(),
    });
  }

  /**
   * Log data access event
   */
  static async logDataAccess(params: {
    userId: string;
    resourceType: string;
    resourceId: string;
    action: string;
    request?: NextRequest;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.DATA_VIEWED,
      severity: AuditSeverity.INFO,
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      action: params.action,
      metadata: params.metadata,
      ipAddress: params.request
        ? this.getClientIP(params.request)
        : undefined,
      userAgent: params.request
        ? params.request.headers.get("user-agent") || undefined
        : undefined,
      success: true,
      timestamp: new Date(),
    });
  }

  /**
   * Log security event
   */
  static async logSecurity(params: {
    eventType: AuditEventType;
    userId?: string;
    description: string;
    request?: NextRequest;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      severity: AuditSeverity.WARNING,
      userId: params.userId,
      action: params.eventType.split(".")[1],
      description: params.description,
      metadata: params.metadata,
      ipAddress: params.request
        ? this.getClientIP(params.request)
        : undefined,
      userAgent: params.request
        ? params.request.headers.get("user-agent") || undefined
        : undefined,
      success: false,
      timestamp: new Date(),
    });
  }

  /**
   * Log payment event
   */
  static async logPayment(params: {
    eventType: AuditEventType;
    userId: string;
    success: boolean;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      severity: params.success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      userId: params.userId,
      resourceType: "payment",
      action: params.eventType.split(".")[1],
      description: params.description,
      metadata: params.metadata,
      success: params.success,
      timestamp: new Date(),
    });
  }

  /**
   * Log admin action
   */
  static async logAdmin(params: {
    eventType: AuditEventType;
    adminId: string;
    userId?: string;
    action: string;
    description: string;
    request?: NextRequest;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: params.eventType,
      severity: AuditSeverity.WARNING, // All admin actions are warnings
      userId: params.adminId,
      resourceType: "admin",
      resourceId: params.userId,
      action: params.action,
      description: params.description,
      metadata: params.metadata,
      ipAddress: params.request
        ? this.getClientIP(params.request)
        : undefined,
      userAgent: params.request
        ? params.request.headers.get("user-agent") || undefined
        : undefined,
      success: true,
      timestamp: new Date(),
    });
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
      return realIP;
    }

    return "unknown";
  }

  /**
   * Query audit logs
   */
  static async query(params: {
    userId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.userId) {
      conditions.push(`user_id = $${conditions.length + 1}`);
      values.push(params.userId);
    }

    if (params.eventType) {
      conditions.push(`event_type = $${conditions.length + 1}`);
      values.push(params.eventType);
    }

    if (params.startDate) {
      conditions.push(`timestamp >= $${conditions.length + 1}`);
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push(`timestamp <= $${conditions.length + 1}`);
      values.push(params.endDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params.limit || 100;

    const query = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${values.length + 1}
    `;

    return await prisma.$queryRawUnsafe(query, ...values, limit);
  }
}
