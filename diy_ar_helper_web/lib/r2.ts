import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

/**
 * Cloudflare R2 Storage Client
 * S3-compatible object storage
 */

// Initialize R2 client
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT;

/**
 * File upload configuration
 */
export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    // Documents
    "application/pdf",
    // 3D Models
    "model/gltf-binary",
    "model/gltf+json",
    "application/octet-stream", // .usdz files
  ],
  allowedExtensions: [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".pdf",
    ".glb",
    ".gltf",
    ".usdz",
  ],
};

/**
 * Generate a unique file key with SHA-256 hash prefix
 */
function generateFileKey(userId: string, filename: string, buffer: Buffer): string {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 16);
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `uploads/${userId}/${hash}-${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload file to R2
 */
export async function uploadToR2(params: {
  userId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string; url: string; hash: string }> {
  const { userId, filename, buffer, mimeType, metadata } = params;

  // Validate file size
  if (buffer.length > UPLOAD_CONFIG.maxFileSize) {
    throw new Error(`File size exceeds maximum of ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`);
  }

  // Validate MIME type
  if (!UPLOAD_CONFIG.allowedMimeTypes.includes(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed`);
  }

  // Generate unique key
  const key = generateFileKey(userId, filename, buffer);

  // Calculate file hash
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Upload to R2
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      userId,
      originalFilename: filename,
      hash,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  });

  await r2Client.send(command);

  // Construct public URL
  const url = `${PUBLIC_URL}/${key}`;

  return { key, url, hash };
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Generate presigned URL for temporary access
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Validate file extension
 */
export function isValidFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? UPLOAD_CONFIG.allowedExtensions.includes(ext) : false;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string | null {
  return filename.toLowerCase().match(/\.[^.]+$/)?.[0] || null;
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}
