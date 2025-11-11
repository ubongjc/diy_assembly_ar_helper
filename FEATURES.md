# DIY Assembly AR Helper - Features & Implementation Guide

**Last Updated:** 2025-11-11
**Version:** 1.0.2 (Production Security + Bug Fixes)
**Branch:** `claude/diy-ar-helper-scaffold-011CV1QyogoYKfTk8ZsLAgDz`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features Implemented](#features-implemented)
4. [Security Features](#security-features)
5. [How to Use](#how-to-use)
6. [API Reference](#api-reference)
7. [Deployment Guide](#deployment-guide)
8. [Roadmap](#roadmap)
9. [Changelog](#changelog)

---

## Overview

DIY Assembly AR Helper is a production-ready augmented reality platform for step-by-step assembly and repair guidance. The application provides:

- **Web Platform**: Manual management, user dashboard, and admin tools
- **iOS App**: AR-guided assembly with part detection and hand placement hints
- **Monetization**: Subscription-based Pro features with Stripe/StoreKit
- **Enterprise**: Manufacturer integrations and API access

---

## Architecture

### Technology Stack

#### Web Application
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL 16 + Prisma 5 + pgvector
- **Auth**: Clerk (Passkey/WebAuthn primary, magic links fallback)
- **Payments**: Stripe
- **Storage**: Cloudflare R2 (S3-compatible)
- **Monitoring**: Sentry + OpenTelemetry
- **UI**: Tailwind CSS + shadcn/ui
- **Validation**: Zod

#### iOS Application
- **Framework**: SwiftUI
- **Language**: Swift 5.9+
- **AR**: RealityKit + ARKit + Vision
- **Auth**: AuthenticationServices (Passkey)
- **Payments**: StoreKit 2
- **Encryption**: CryptoKit (AES-GCM-256)
- **Architecture**: Modular MVVM with Combine

### Database Schema

#### Core Models

**User**
- `id`: Unique identifier (CUID)
- `clerkId`: Clerk user ID (unique)
- `email`: Email address (unique, nullable)
- `name`: Display name
- `role`: Role (USER, PRO, MANUFACTURER, ADMIN)
- `permissions`: ABAC permissions (JSON)
- `subscriptionTier`: free, pro, manufacturer
- `stripeCustomerId`: Stripe customer ID

**Manual**
- `id`: Unique identifier
- `userId`: Owner ID
- `brand`: Manufacturer brand
- `model`: Product model
- `category`: Category (e.g., Electronics, Furniture)
- `title`: Manual title
- `description`: Description
- `steps`: Array of step objects (JSON)
- `partsRequired`: Required parts list
- `toolsRequired`: Required tools list
- `estimatedTime`: Estimated completion time (minutes)
- `difficultyLevel`: easy, medium, hard
- `isPublic`: Public visibility flag
- `isPro`: Pro subscription required
- `imageUrls`: Image URLs from R2
- `encryptedBlobs`: Encrypted sensitive data (ciphertext only)

**Session**
- `id`: Unique identifier
- `userId`: User ID
- `manualId`: Manual being followed
- `currentStep`: Current step index
- `stepStates`: Array of completion states
- `status`: IN_PROGRESS, COMPLETED, PAUSED, ABANDONED
- `deviceType`: ios, web
- `arData`: AR-specific session data
- `telemetry`: Anonymized usage telemetry

**Subscription**
- `id`: Unique identifier
- `userId`: User ID (unique)
- `stripeSubscriptionId`: Stripe subscription ID
- `applePurchaseId`: Apple purchase ID
- `tier`: free, pro, manufacturer
- `status`: active, cancelled, past_due
- `currentPeriodEnd`: Subscription end date

#### Security & Compliance Models

**AuditLog**
- `id`: Unique identifier
- `eventType`: Event type (auth.login, payment.succeeded, etc.)
- `severity`: Severity level (info, warning, error, critical)
- `userId`: User ID (nullable)
- `resourceType`: Resource type (nullable)
- `resourceId`: Resource ID (nullable)
- `action`: Action performed
- `description`: Event description (nullable)
- `metadata`: Additional metadata (JSON)
- `ipAddress`: Client IP address (nullable)
- `userAgent`: User agent string (nullable)
- `success`: Success flag
- `timestamp`: Event timestamp
- **Indexes**: userId, eventType, timestamp, severity

**APIKey**
- `id`: Unique identifier
- `userId`: Owner user ID
- `name`: Key name
- `keyHash`: SHA-256 hash (unique)
- `prefix`: Key prefix for display
- `scopes`: Permissions (JSON)
- `rateLimit`: Rate limit (requests per hour)
- `lastUsedAt`: Last usage timestamp (nullable)
- `expiresAt`: Expiration date (nullable)
- `isActive`: Active flag
- **Indexes**: userId, keyHash, isActive

**Notification**
- `id`: Unique identifier
- `userId`: Target user ID
- `type`: Notification type (payment, security, feature, etc.)
- `title`: Notification title
- `message`: Notification message
- `link`: Action link (nullable)
- `isRead`: Read flag
- `readAt`: Read timestamp (nullable)
- **Indexes**: userId, isRead, createdAt

**EmailQueue**
- `id`: Unique identifier
- `userId`: Target user ID (nullable)
- `to`: Recipient email
- `subject`: Email subject
- `body`: Email body (HTML)
- `template`: Template name
- `variables`: Template variables (JSON)
- `status`: pending, sent, failed
- `sentAt`: Sent timestamp (nullable)
- `error`: Error message (nullable)
- **Indexes**: status, createdAt

#### Feature Models

**FileUpload**
- `id`: Unique identifier
- `userId`: Uploader user ID
- `filename`: Original filename
- `mimeType`: MIME type
- `size`: File size (bytes)
- `url`: R2 URL
- `encryptedKey`: Encryption key (nullable)
- `hash`: SHA-256 hash
- `manualId`: Associated manual (nullable)
- **Indexes**: userId, manualId, hash

**ManualReview**
- `id`: Unique identifier
- `userId`: Reviewer user ID
- `manualId`: Manual being reviewed
- `rating`: Rating (1-5)
- `comment`: Review comment
- `helpful`: Helpful votes count
- `reported`: Reported flag
- **Indexes**: userId, manualId

**Favorite**
- `id`: Unique identifier
- `userId`: User ID
- `manualId`: Favorited manual ID
- **Unique**: [userId, manualId] composite

**SearchAnalytics**
- `id`: Unique identifier
- `userId`: Searching user ID (nullable)
- `query`: Search query
- `filters`: Applied filters (JSON)
- `resultsCount`: Number of results
- `clickedManualId`: Clicked manual ID (nullable)

**FeatureFlag**
- `id`: Unique identifier
- `name`: Flag name (unique)
- `description`: Flag description
- `isEnabled`: Enabled flag
- `rolloutPercentage`: Rollout percentage (0-100)
- `userIds`: Enabled user IDs (array)

---

## Features Implemented

### ✅ Authentication & Authorization

#### Passkey/WebAuthn (Primary)
- **Web**: Clerk integration with passkey support
- **iOS**: Native AuthenticationServices implementation
- **Features**:
  - Biometric authentication (Face ID, Touch ID)
  - Device-bound credentials
  - Phishing-resistant
  - No passwords to manage

#### Magic Links (Fallback)
- Email-based authentication
- One-time secure links
- Automatic expiration

#### Authorization
- **ABAC (Attribute-Based Access Control)**
  - Fine-grained permissions
  - Resource-level access control
  - Role hierarchy: USER < PRO < MANUFACTURER < ADMIN
- **Middleware Protection**
  - Route-level authentication
  - API endpoint protection
  - Automatic 401/403 responses

#### User Sync
- Webhook-based sync between Clerk and database
- Real-time user creation/updates
- Automatic cleanup on deletion

**Files**:
- `diy_ar_helper_web/middleware.ts` - Route protection
- `diy_ar_helper_web/lib/auth.ts` - Auth utilities
- `diy_ar_helper_web/app/api/webhook/clerk/route.ts` - User sync
- `diy_ar_helper_ios/DIYARHelper/Modules/Auth/AuthManager.swift` - iOS auth
- `diy_ar_helper_ios/DIYARHelper/Modules/Auth/SignInView.swift` - iOS UI

### ✅ Database & ORM

#### Prisma Configuration
- PostgreSQL 16 with pgvector extension
- Type-safe database access
- Automatic migrations
- Connection pooling

#### Schema Features
- User management with roles
- Manual storage with JSON steps
- Session tracking
- Subscription management
- GDPR compliance (export/delete)
- Part detection cache

**Files**:
- `diy_ar_helper_web/prisma/schema.prisma` - Database schema
- `diy_ar_helper_web/lib/prisma.ts` - Prisma client singleton

### ✅ API Endpoints

#### Health Check
```
GET /api/health
```
Returns service health status, version, and timestamp.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-11T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

#### Manual Ingestion
```
POST /api/manual/ingest
```
Ingest a new manual with validation.

**Request**:
```json
{
  "brand": "IKEA",
  "model": "BILLY",
  "category": "Furniture",
  "title": "BILLY Bookcase Assembly",
  "description": "Complete assembly guide",
  "steps": [
    {
      "order": 1,
      "title": "Prepare parts",
      "description": "Lay out all parts...",
      "imageUrl": "https://...",
      "estimatedTime": 5,
      "warnings": ["Check all parts before starting"],
      "partsUsed": ["Panel A", "Panel B"]
    }
  ],
  "partsRequired": ["Screws", "Dowels"],
  "toolsRequired": ["Phillips screwdriver"],
  "estimatedTime": 45,
  "difficultyLevel": "easy",
  "isPublic": false,
  "isPro": false
}
```

**Response**:
```json
{
  "success": true,
  "manual": {
    "id": "clx...",
    "brand": "IKEA",
    "model": "BILLY",
    "title": "BILLY Bookcase Assembly",
    "createdAt": "2025-11-11T00:00:00.000Z"
  }
}
```

**Authorization**: Requires authenticated user

#### Retrieve Manual
```
GET /api/manual/{id}
```
Retrieve manual by ID with access control.

**Response**:
```json
{
  "success": true,
  "manual": {
    "id": "clx...",
    "userId": "user_...",
    "brand": "IKEA",
    "model": "BILLY",
    "title": "BILLY Bookcase Assembly",
    "steps": [...],
    "user": {
      "id": "user_...",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Access Control**:
- Public manuals: Anyone can access
- Private manuals: Owner only
- Pro manuals: Pro subscribers + owner

#### Delete Manual
```
DELETE /api/manual/{id}
```
Delete manual (owner only).

**Response**:
```json
{
  "success": true,
  "message": "Manual deleted successfully"
}
```

**Authorization**: Owner only

#### Clerk Webhook
```
POST /api/webhook/clerk
```
Sync user data from Clerk.

**Events Handled**:
- `user.created` - Create user in database
- `user.updated` - Update user data
- `user.deleted` - Delete user and all data

**Security**: Svix signature verification

**Files**:
- `diy_ar_helper_web/app/api/health/route.ts`
- `diy_ar_helper_web/app/api/manual/ingest/route.ts`
- `diy_ar_helper_web/app/api/manual/[id]/route.ts`
- `diy_ar_helper_web/app/api/webhook/clerk/route.ts`

### ✅ Client-Side Encryption

#### iOS Implementation
- **Algorithm**: AES-GCM-256
- **Library**: CryptoKit (Apple native)
- **Key Storage**: Keychain with device-only access
- **Features**:
  - Authenticated encryption
  - Key derivation (PBKDF2/HKDF)
  - Secure random nonce generation
  - Base64 encoding for transport

**Encryption Flow**:
1. Generate or retrieve encryption key
2. Encrypt sensitive data before upload
3. Upload ciphertext + nonce + tag
4. Server stores encrypted blob
5. Download and decrypt on client

**Files**:
- `diy_ar_helper_ios/DIYARHelper/Modules/Crypto/CryptoManager.swift` - Encryption
- `diy_ar_helper_ios/DIYARHelper/Modules/Crypto/KeychainManager.swift` - Key storage

### ✅ iOS Networking Layer

#### Features
- Type-safe API client
- Automatic JSON encoding/decoding
- Bearer token authentication
- Error handling with custom errors
- Async/await support
- Loading state management

#### Endpoints Supported
- Health check
- Manual fetch
- Manual ingestion
- Session management (structure ready)

**Files**:
- `diy_ar_helper_ios/DIYARHelper/Modules/Networking/NetworkManager.swift`
- `diy_ar_helper_ios/DIYARHelper/Models/Manual.swift`

### ✅ iOS User Interface

#### Authentication Screens
- **Sign In**: Passkey authentication with magic link fallback
- **Registration**: Create account with passkey
- **Error Handling**: User-friendly error messages

#### Manual Management
- **Manual List**: Browse, search, filter by category
- **Manual Detail**: View steps, parts, tools, metadata
- **Difficulty Badges**: Visual difficulty indicators
- **Time Estimates**: Per-step and total time

#### AR Features (Framework)
- **AR Session View**: Full-screen AR experience
- **Step Navigation**: Previous/Next controls
- **Step Cards**: Current step information with warnings
- **Coaching Overlay**: ARKit coaching for plane detection
- **Controls Toggle**: Hide/show step controls

#### Settings
- **Profile Management**: Edit name, email
- **Subscription**: View tier, upgrade to Pro
- **Privacy Controls**: Passkey management, data export
- **Preferences**: Notifications, offline mode, haptics
- **Support**: Help center, feedback

**Files**:
- `diy_ar_helper_ios/DIYARHelper/Views/ContentView.swift`
- `diy_ar_helper_ios/DIYARHelper/Modules/Auth/SignInView.swift`
- `diy_ar_helper_ios/DIYARHelper/Modules/AR/ManualListView.swift`
- `diy_ar_helper_ios/DIYARHelper/Modules/AR/ManualDetailView.swift`
- `diy_ar_helper_ios/DIYARHelper/Modules/AR/ARSessionView.swift`
- `diy_ar_helper_ios/DIYARHelper/Modules/Settings/SettingsView.swift`

### ✅ Monitoring & Observability

#### Sentry Configuration
- Client-side error tracking
- Server-side error tracking
- Session replay (with privacy masking)
- Performance monitoring
- Custom error boundaries

**Configuration**:
- Sample rate: 100% (development), adjust for production
- Replays: 10% of sessions
- Privacy: All text/media masked by default

**Files**:
- `diy_ar_helper_web/sentry.client.config.ts`
- `diy_ar_helper_web/sentry.server.config.ts`

### ✅ UI Component Library

#### shadcn/ui Setup
- Tailwind CSS integration
- Component configuration
- Utility functions (cn helper)
- Icon library (Lucide)
- New York style theme

**Files**:
- `diy_ar_helper_web/components.json`
- `diy_ar_helper_web/lib/utils.ts`

---

## Security Features

### 🔒 Authentication Security

- **Passkey/WebAuthn**: Phishing-resistant, FIDO2 compliant
- **No Password Storage**: Zero password attack surface
- **Biometric Authentication**: Device-level security
- **Session Management**: Secure token storage (Keychain/HttpOnly cookies)

### 🔒 Authorization Security

- **ABAC**: Fine-grained permissions
- **Role Hierarchy**: Tiered access control
- **Resource Ownership**: User-level data isolation
- **Middleware Protection**: Automatic route protection

### 🔒 Data Security

- **Client-Side Encryption**: AES-GCM-256 for sensitive data
- **Encryption at Rest**: Server only stores ciphertext
- **Keychain Storage**: iOS secure enclave integration
- **No Face Recording**: Privacy-first AR implementation

### 🔒 API Security

- **Input Validation**: Zod schema validation
- **Type Safety**: TypeScript end-to-end
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **Webhook Verification**: Svix signature validation

### 🔒 Privacy & Compliance

- **GDPR Compliance**: Data export/delete functionality
- **Minimal Data Collection**: Only essential data stored
- **Anonymized Telemetry**: No PII in analytics
- **Transparent Privacy**: Clear privacy policy requirements

### 🔒 Rate Limiting

- **Three-Tier System**:
  - **Standard**: 10 requests per 10 seconds (general API)
  - **Strict**: 5 requests per 60 seconds (auth, payments)
  - **Expensive**: 3 requests per 300 seconds (uploads, AI processing)
- **Sliding Window Algorithm**: Upstash Redis integration
- **Development Fallback**: In-memory store with automatic cleanup
- **Response Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Identifier Strategy**: User ID > API Key > IP Address (sanitized)
- **429 Status**: Proper Retry-After headers

**Files**:
- `diy_ar_helper_web/lib/rate-limit.ts` - Rate limiting implementation
- `diy_ar_helper_web/middleware.ts` - Rate limit enforcement

### 🔒 CSRF Protection

- **Double Submit Cookie Pattern**: Cryptographically secure tokens
- **Token Generation**: 32-byte random tokens via crypto module
- **Timing-Safe Comparison**: Prevents timing attacks
- **Automatic Token Management**: Set on GET, verify on POST/PUT/DELETE
- **Cookie Settings**: HttpOnly, Secure, SameSite=Strict
- **24-Hour Expiry**: Automatic token rotation

**Files**:
- `diy_ar_helper_web/lib/security.ts` - CSRF implementation
- `diy_ar_helper_web/middleware.ts` - CSRF enforcement

### 🔒 Security Headers

- **Content Security Policy (CSP)**: Prevents XSS attacks
  - Strict `default-src`, `script-src`, `style-src` policies
  - No `unsafe-eval` except where required by Clerk
  - `frame-ancestors 'none'` prevents clickjacking
  - `upgrade-insecure-requests` enforces HTTPS
- **HSTS**: HTTP Strict Transport Security (production)
  - Max age: 1 year
  - includeSubDomains + preload
- **X-Frame-Options**: DENY (anti-clickjacking)
- **X-Content-Type-Options**: nosniff (MIME type security)
- **X-XSS-Protection**: Enabled with block mode
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Camera (self only), no geolocation/mic/usb

**Files**:
- `diy_ar_helper_web/lib/security.ts` - Header configuration
- `diy_ar_helper_web/middleware.ts` - Header application

### 🔒 Audit Logging

- **Comprehensive Event Tracking**: 40+ event types
  - Authentication (login, logout, failed attempts, 2FA)
  - User management (CRUD, role changes, permissions)
  - Data access (viewed, exported, deleted)
  - Manual operations (CRUD, publish/unpublish)
  - Session operations (started, completed, abandoned)
  - Payment operations (succeeded, failed, refunds)
  - Security events (rate limits, invalid tokens, CSRF failures)
  - Admin operations (impersonation, settings changes)
  - API operations (key management, failed requests)
- **Severity Levels**: INFO, WARNING, ERROR, CRITICAL
- **Rich Metadata**: IP address, user agent, resource IDs, custom metadata
- **Non-Blocking**: Audit failures don't break application
- **Critical Alerts**: Console logging for critical events
- **Query Interface**: Date ranges, user filters, event type filters

**Files**:
- `diy_ar_helper_web/lib/audit-log.ts` - Audit logging system
- `diy_ar_helper_web/prisma/schema.prisma` - AuditLog model

### 🔒 Payment Security

- **Stripe Integration**: PCI-compliant payment processing
- **Webhook Verification**: HMAC signature validation
- **Subscription Tiers**: Free, Pro ($9.99/month), Manufacturer ($49.99/month)
- **Trial Periods**: 7-day free trial for paid tiers
- **Atomic Operations**: Database transactions prevent race conditions
- **Audit Trail**: All payment events logged
- **Error Handling**: Graceful failure with user notifications
- **Customer Management**: Automatic Stripe customer creation

**Files**:
- `diy_ar_helper_web/lib/stripe.ts` - Stripe integration
- `diy_ar_helper_web/app/api/webhook/stripe/route.ts` - Webhook handler
- `diy_ar_helper_web/prisma/schema.prisma` - Subscription model

### 🔒 Input Sanitization

- **XSS Prevention**: HTML and JavaScript sanitization
- **SQL Injection**: Prevented via Prisma ORM (no raw queries)
- **Path Traversal**: Filename sanitization
- **Email Validation**: RFC-compliant regex
- **URL Validation**: Protocol whitelist (http/https only)
- **API Key Sanitization**: Character whitelist and length limits
- **IP Address Sanitization**: IPv4/IPv6 validation

**Files**:
- `diy_ar_helper_web/lib/security.ts` - InputSanitizer class

---

## How to Use

### Web Application Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 16+
- Clerk account
- Stripe account
- Cloudflare R2 bucket
- Sentry account (optional)

#### Installation

1. **Clone and navigate**:
   ```bash
   cd diy_ar_helper_web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in:
   - `DATABASE_URL` - PostgreSQL connection string
   - `CLERK_SECRET_KEY` - From Clerk dashboard
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `STRIPE_SECRET_KEY` - From Stripe dashboard
   - `R2_*` - Cloudflare R2 credentials
   - `SENTRY_DSN` - From Sentry project

4. **Set up database**:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

6. **Access application**:
   - Web: http://localhost:3000
   - API: http://localhost:3000/api

#### Production Build

```bash
npm run build
npm start
```

### iOS Application Setup

#### Prerequisites
- macOS 14+
- Xcode 15+
- Apple Developer account (for device testing)
- iOS 17+ device or simulator

#### Installation

1. **Navigate to iOS directory**:
   ```bash
   cd diy_ar_helper_ios
   ```

2. **Create Xcode project**:
   - Open Xcode
   - File → New → Project
   - iOS → App
   - Product Name: DIYARHelper
   - Organization Identifier: com.diyarhelper
   - Interface: SwiftUI
   - Language: Swift

3. **Add source files**:
   - Drag the `DIYARHelper` folder into Xcode project

4. **Configure capabilities**:
   - Signing & Capabilities tab
   - Add: Associated Domains (for passkeys)
   - Add: Keychain Sharing
   - Add: In-App Purchase (for StoreKit)

5. **Update configuration**:
   - Edit `NetworkManager.swift`
   - Change `baseURL` to your API URL

6. **Run application**:
   - Select simulator or device
   - Press ⌘R to build and run

### User Workflows

#### Creating an Account

**Web**:
1. Visit homepage
2. Click "Sign Up"
3. Choose passkey or magic link
4. Complete registration
5. Dashboard loads automatically

**iOS**:
1. Launch app
2. Tap "Create Account"
3. Enter username and email
4. Tap "Create Account & Passkey"
5. Authenticate with Face ID/Touch ID
6. Account created

#### Ingesting a Manual

**Web** (via API):
```bash
curl -X POST http://localhost:3000/api/manual/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "IKEA",
    "model": "BILLY",
    "title": "BILLY Bookcase Assembly",
    "steps": [...]
  }'
```

**iOS**:
```swift
let manual = ManualIngestRequest(
    brand: "IKEA",
    model: "BILLY",
    title: "BILLY Bookcase Assembly",
    steps: steps
)
let result = try await networkManager.ingestManual(manual)
```

#### Following a Manual in AR

**iOS**:
1. Browse manuals in Manual List
2. Tap manual to view details
3. Tap "Start AR Guide"
4. Point camera at workspace
5. Follow on-screen instructions
6. Navigate through steps
7. Complete assembly

---

## API Reference

See [API Endpoints](#-api-endpoints) section above for detailed endpoint documentation.

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

### Authentication
All protected endpoints require Bearer token:
```
Authorization: Bearer <your_token>
```

Get token from Clerk session on web or Keychain on iOS.

---

## Deployment Guide

### Web Application

#### Recommended Platforms
- **Vercel**: Next.js optimized, automatic deployments
- **Railway**: With managed PostgreSQL
- **Fly.io**: Global edge deployment

#### Vercel Deployment

1. **Connect repository**:
   - Import project in Vercel dashboard
   - Select `diy_ar_helper_web` as root directory

2. **Configure environment variables**:
   - Add all variables from `.env.example`
   - Mark sensitive variables as encrypted

3. **Configure build**:
   - Framework: Next.js
   - Build command: `npm run build`
   - Output directory: `.next`

4. **Deploy**:
   - Push to main branch triggers deployment
   - Preview deployments for PRs

#### Database Migration

```bash
npx prisma migrate deploy
```

### iOS Application

#### App Store Submission

1. **Archive build**:
   - Product → Archive in Xcode
   - Validate archive

2. **Upload to App Store Connect**:
   - Distribute App → App Store Connect
   - Select provisioning profile

3. **Configure App Store listing**:
   - Screenshots
   - Description
   - Privacy policy URL
   - Support URL

4. **Submit for review**:
   - Wait for approval
   - Release to App Store

#### TestFlight

1. **Create beta**:
   - Upload build to App Store Connect
   - Add to TestFlight

2. **Invite testers**:
   - Internal testers (immediate)
   - External testers (review required)

---

## Roadmap

### ✅ Completed

#### Security Enhancements
- [x] Rate limiting middleware (v1.0.1)
- [x] CSRF protection (v1.0.1)
- [x] Security headers (CSP, HSTS) (v1.0.1)
- [x] Input sanitization (v1.0.1)
- [x] XSS prevention (v1.0.1)
- [x] SQL injection prevention (v1.0.2)
- [x] Audit logging system (v1.0.1)
- [ ] 2FA backup methods
- [ ] Password recovery for magic links
- [ ] Email verification

#### Payment Integration
- [x] Complete Stripe setup (v1.0.1)
  - [x] Subscription creation
  - [x] Webhook handling
  - [x] Invoice generation
  - [x] Payment method management
  - [x] Trial periods
  - [x] Promo codes support
- [ ] StoreKit integration
  - [ ] Product configuration
  - [ ] Purchase flow
  - [ ] Receipt validation
  - [ ] Subscription sync
  - [ ] Restore purchases

### 🔜 In Progress

#### Core Features
- [ ] Manual search and filtering
- [ ] File upload handling
- [ ] Cloudflare R2 integration
- [ ] Image optimization
- [ ] Session progress tracking
- [ ] Notification system
- [ ] Email templates
- [ ] Push notifications (iOS)

#### Admin & Analytics
- [ ] Admin dashboard
- [ ] User analytics
- [ ] Revenue metrics
- [ ] Usage statistics
- [ ] Content moderation
- [ ] Manufacturer portal
- [ ] API key management

#### AR Features
- [ ] Part detection (Vision + CoreML)
- [ ] Hand placement hints
- [ ] Torque warnings
- [ ] Offline packs
- [ ] 3D model rendering
- [ ] Step replay

#### Social Features
- [ ] Manual sharing
- [ ] User reviews
- [ ] Ratings system
- [ ] Community manuals
- [ ] Favorites/bookmarks

### 🎯 Future Enhancements

- [ ] Multi-language support
- [ ] Voice guidance
- [ ] PDF/image scanning
- [ ] OCR for step extraction
- [ ] Video step support
- [ ] Collaborative sessions
- [ ] Live support chat
- [ ] Android app
- [ ] Apple Watch companion
- [ ] Mac app (Apple Silicon)

---

## Changelog

### Version 1.0.2 - Critical Bug Fixes (2025-11-11)

#### 🐛 Critical Bugs Fixed

**SQL Injection Vulnerability (CRITICAL)**
- **Location**: `lib/audit-log.ts`
- **Issue**: Raw SQL queries with string concatenation created SQL injection vulnerability
- **Fix**: Replaced all `$executeRaw` and `$queryRawUnsafe` with Prisma ORM operations
- **Impact**: Eliminated critical security vulnerability
- **Files**: `lib/audit-log.ts:102-329`

**Application Crash on CSRF Validation (HIGH)**
- **Location**: `lib/security.ts`
- **Issue**: `crypto.timingSafeEqual()` throws when buffer lengths differ
- **Fix**: Added length validation before comparison + try-catch error handling
- **Impact**: Prevents application crashes during CSRF validation
- **Files**: `lib/security.ts:93-123`

**Memory Leak in Development Mode (MEDIUM)**
- **Location**: `lib/rate-limit.ts`
- **Issue**: In-memory rate limit store never cleaned up expired entries
- **Fix**: Added setInterval cleanup running every 5 minutes
- **Impact**: Prevents memory growth in development
- **Files**: `lib/rate-limit.ts:50-59`

**Race Condition in Webhook Handler (HIGH)**
- **Location**: `app/api/webhook/stripe/route.ts`
- **Issue**: Multiple database operations without transactions allowed data inconsistency
- **Fix**: Wrapped subscription and user updates in Prisma transaction
- **Impact**: Ensures atomic payment operations
- **Files**: `app/api/webhook/stripe/route.ts:114-140`

**Missing Security Integration (CRITICAL)**
- **Location**: `middleware.ts`
- **Issue**: Middleware had no CSRF protection, rate limiting, or security headers
- **Fix**: Complete rewrite with security chain (headers → CSRF → rate limiting → auth)
- **Impact**: Production-grade security on every request
- **Files**: `middleware.ts:1-138`

#### 🔒 Security Improvements
- ✅ Timing-safe CSRF token comparison
- ✅ Input sanitization for IP addresses and API keys
- ✅ Proper error handling in security utilities
- ✅ Transaction-based payment operations
- ✅ Comprehensive security middleware integration

---

### Version 1.0.1 - Production Security & Payments (2025-11-11)

#### 🔒 Security Features Added

**Rate Limiting**
- Three-tier rate limiting system (standard/strict/expensive)
- Upstash Redis integration with in-memory fallback
- Sliding window algorithm
- Proper HTTP 429 responses with Retry-After headers
- **Files**: `lib/rate-limit.ts`, `middleware.ts`

**CSRF Protection**
- Double-submit cookie pattern
- 32-byte cryptographically secure tokens
- Timing-safe token comparison
- Automatic token management (GET/POST)
- HttpOnly, Secure, SameSite=Strict cookies
- **Files**: `lib/security.ts`, `middleware.ts`

**Security Headers**
- Content Security Policy (CSP) with strict policies
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options (clickjacking prevention)
- X-Content-Type-Options (MIME sniffing prevention)
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy
- **Files**: `lib/security.ts`

**Audit Logging**
- 40+ event types tracked
- 4 severity levels (INFO, WARNING, ERROR, CRITICAL)
- Rich metadata (IP, user agent, resource IDs)
- Query interface with date/user/event filters
- Non-blocking logging
- **Files**: `lib/audit-log.ts`, `prisma/schema.prisma`

**Input Sanitization**
- XSS prevention utilities
- Path traversal protection
- Email/URL validation
- API key sanitization
- IP address sanitization
- **Files**: `lib/security.ts`

#### 💳 Payment Integration

**Stripe Integration**
- Complete subscription management
- Three tiers: Free, Pro ($9.99), Manufacturer ($49.99)
- 7-day free trial for paid tiers
- Webhook handler for all events
- Automatic customer creation
- Trial periods and promo codes
- **Files**: `lib/stripe.ts`, `app/api/webhook/stripe/route.ts`

**Subscription Events**
- Subscription created/updated/deleted
- Invoice payment succeeded/failed
- Charge refunded
- Customer created/deleted
- Atomic database operations
- **Files**: `app/api/webhook/stripe/route.ts`

#### 📊 Database Extensions

**New Models Added**:
- `AuditLog` - Comprehensive event logging
- `APIKey` - Manufacturer API key management
- `Notification` - In-app notifications
- `EmailQueue` - Email delivery queue
- `FileUpload` - File metadata and encryption keys
- `ManualReview` - User reviews and ratings
- `Favorite` - User favorites
- `SearchAnalytics` - Search query analytics
- `FeatureFlag` - Feature flag management
- **Files**: `prisma/schema.prisma`

#### 🔧 Configuration Updates

**Environment Variables**:
- `CLERK_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_PRO_PRICE_ID` - Pro plan price ID
- `STRIPE_MANUFACTURER_PRICE_ID` - Manufacturer plan price ID
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `UPSTASH_REDIS_REST_URL` - Redis for rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication
- **Files**: `.env.example`

#### 📝 Documentation
- ✅ Updated FEATURES.md with all security features
- ✅ Documented API security utilities
- ✅ Added payment integration guides
- ✅ Comprehensive database schema documentation

---

### Version 1.0.0 - Initial Scaffold (2025-11-11)

#### Added
- ✅ Next.js 15 web application with TypeScript and Tailwind
- ✅ Prisma database schema with PostgreSQL and pgvector
- ✅ Clerk authentication with passkey support
- ✅ Core API endpoints (health, manual CRUD, webhooks)
- ✅ ABAC authorization system
- ✅ iOS SwiftUI application with modular architecture
- ✅ Passkey authentication on iOS
- ✅ Client-side encryption with CryptoKit
- ✅ Networking layer with type-safe API client
- ✅ AR session framework with RealityKit
- ✅ Manual browsing and detail views
- ✅ Settings with subscription management
- ✅ Sentry monitoring configuration
- ✅ shadcn/ui component library
- ✅ Comprehensive documentation (README, FEATURES)

#### Security
- ✅ Passkey/WebAuthn authentication
- ✅ Client-side encryption (AES-GCM-256)
- ✅ Input validation with Zod
- ✅ SQL injection prevention with Prisma
- ✅ Webhook signature verification
- ✅ Role-based access control
- ✅ Secure token storage (Keychain/HttpOnly)

#### Documentation
- ✅ README.md with setup instructions
- ✅ FEATURES.md with comprehensive documentation
- ✅ .env.example with all variables
- ✅ Inline code documentation

---

## Support

### Documentation
- README: Setup and architecture
- FEATURES: This file
- Prisma Schema: Database structure
- API Routes: Inline JSDoc comments

### Issues
Report issues on GitHub:
- Security issues: security@diyarhelper.com (private)
- Bug reports: GitHub Issues
- Feature requests: GitHub Discussions

### Contact
- Email: support@diyarhelper.com
- Documentation: https://docs.diyarhelper.com
- Status: https://status.diyarhelper.com

---

**Built with security and privacy first for makers, tinkerers, and DIY enthusiasts worldwide.**
