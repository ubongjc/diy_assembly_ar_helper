# DIY Assembly AR Helper

> AR overlay for step-by-step assembly/repair using scanned manuals and detected parts.

## Overview

DIY Assembly AR Helper provides augmented reality guidance for assembly and repair tasks. The platform combines:
- **Web Application**: Next.js 15 with TypeScript for manual ingestion, management, and user dashboard
- **iOS Application**: Native SwiftUI app with AR capabilities using RealityKit and ARKit

## Repository Structure

```
diy_assembly_ar_helper/
├── diy_ar_helper_web/     # Next.js web application
└── diy_ar_helper_ios/     # iOS SwiftUI application
```

## Tech Stack

### Web (diy_ar_helper_web)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Database**: PostgreSQL 16 with Prisma 5
- **Auth**: Clerk (Passkey/WebAuthn support)
- **Payments**: Stripe
- **Storage**: Cloudflare R2 (S3-compatible)
- **Observability**: Sentry + OpenTelemetry
- **UI**: Tailwind CSS + shadcn/ui

### iOS (diy_ar_helper_ios)
- **Framework**: SwiftUI
- **AR**: RealityKit + ARKit
- **Auth**: Passkey (AuthenticationServices)
- **Encryption**: CryptoKit (AES-GCM)
- **Architecture**: Modular design with Combine for reactive programming

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Xcode 15+ (for iOS development)
- Clerk account
- Stripe account
- Cloudflare R2 bucket

### Web Application Setup

1. **Navigate to web directory**:
   ```bash
   cd diy_ar_helper_web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Fill in all required environment variables in `.env`

4. **Set up database**:
   ```bash
   # Create database
   createdb diy_ar_helper

   # Run migrations
   npx prisma migrate dev

   # Generate Prisma client
   npx prisma generate
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

   The web app will be available at `http://localhost:3000`

### iOS Application Setup

1. **Navigate to iOS directory**:
   ```bash
   cd diy_ar_helper_ios
   ```

2. **Open in Xcode**:
   ```bash
   open DIYARHelper.xcodeproj
   ```
   (Note: If the Xcode project doesn't exist yet, you'll need to create it via Xcode: File > New > Project > iOS > App)

3. **Configure app**:
   - Update Bundle Identifier in project settings
   - Configure Associated Domains for passkey support
   - Add required capabilities: Associated Domains, Keychain Sharing
   - Update API base URL in NetworkManager.swift

4. **Run on simulator or device**:
   - Select target device
   - Press ⌘R to build and run

## Architecture

### Web Application

```
diy_ar_helper_web/
├── app/
│   ├── api/              # API routes
│   │   ├── health/       # Health check endpoint
│   │   ├── manual/       # Manual CRUD operations
│   │   └── webhook/      # Webhook handlers (Clerk, Stripe)
│   ├── (auth)/           # Auth-protected pages
│   └── layout.tsx        # Root layout
├── components/
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── auth.ts           # Auth utilities with ABAC
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts          # Utility functions
├── prisma/
│   └── schema.prisma     # Database schema
└── middleware.ts         # Clerk middleware
```

### iOS Application

```
diy_ar_helper_ios/DIYARHelper/
├── DIYARHelperApp.swift  # App entry point
├── Models/               # Data models
│   └── Manual.swift
├── Modules/
│   ├── Auth/            # Authentication module
│   │   ├── AuthManager.swift
│   │   └── SignInView.swift
│   ├── Networking/      # API client
│   │   └── NetworkManager.swift
│   ├── Crypto/          # Encryption module
│   │   ├── CryptoManager.swift
│   │   └── KeychainManager.swift
│   ├── AR/              # AR features
│   │   ├── ManualListView.swift
│   │   ├── ManualDetailView.swift
│   │   └── ARSessionView.swift
│   └── Settings/        # Settings module
│       └── SettingsView.swift
└── Views/
    └── ContentView.swift # Root view
```

## Key Features

### Implemented in Scaffold

✅ **Authentication**
- Passkey/WebAuthn support (web & iOS)
- Clerk integration with webhook sync
- ABAC (Attribute-Based Access Control)

✅ **Database Schema**
- User management with roles
- Manual ingestion and storage
- Session tracking
- Subscription management
- Data Subject Rights (GDPR)

✅ **API Endpoints**
- `GET /api/health` - Health check
- `POST /api/manual/ingest` - Ingest new manual
- `GET /api/manual/{id}` - Retrieve manual
- `DELETE /api/manual/{id}` - Delete manual
- `POST /api/webhook/clerk` - Clerk user sync

✅ **iOS Features**
- Passkey authentication
- Client-side encryption (AES-GCM)
- AR session framework
- Manual browsing and detail views
- Settings with subscription management

✅ **Security**
- Client-side encryption for sensitive data
- Keychain storage for tokens
- HTTPS-only communication
- Input validation with Zod

### Roadmap (Not Yet Implemented)

🔜 **AR Features**
- Part detection using Vision/CoreML
- Hand placement hints
- Torque warnings
- Offline pack downloads

🔜 **Manual Processing**
- PDF/image scanning
- OCR for step extraction
- Image processing pipeline

🔜 **Additional API Endpoints**
- Session progress tracking
- Search and filtering
- User-generated content

🔜 **Monetization**
- Full Stripe integration
- StoreKit for iOS
- Subscription entitlements

## Development Workflow

### Database Changes

When modifying the Prisma schema:

```bash
# Create a migration
npx prisma migrate dev --name description_of_change

# Apply migrations
npx prisma migrate deploy

# Regenerate client
npx prisma generate
```

### API Development

1. Add route handler in `app/api/[resource]/route.ts`
2. Implement validation with Zod
3. Add authorization checks using `getCurrentUser()`
4. Update iOS NetworkManager to consume new endpoint

### iOS Development

1. Update data models in `Models/`
2. Add API methods to `NetworkManager`
3. Create/update views in respective modules
4. Use `@EnvironmentObject` for dependency injection

## Security Considerations

### Client-Side Encryption

Sensitive data is encrypted on the client before upload:
- iOS: Uses CryptoKit (AES-GCM)
- Web: Should implement Web Crypto API
- Server only stores ciphertext

### Authentication

- Primary: Passkey (FIDO2/WebAuthn)
- Fallback: Magic links
- Tokens stored in Keychain (iOS) and HttpOnly cookies (web)

### Data Privacy

- No facial recognition or recording
- Anonymized telemetry only
- Full GDPR compliance with export/delete
- Minimal data collection

## Environment Variables

See `.env.example` in `diy_ar_helper_web/` for all required environment variables.

Critical variables:
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk authentication
- `STRIPE_SECRET_KEY` - Payment processing
- `R2_*` - Cloudflare R2 storage
- `SENTRY_DSN` - Error tracking

## Testing

### Web
```bash
# Run tests (when implemented)
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### iOS
- Use Xcode's Test Navigator (⌘6)
- Run tests with ⌘U

## Deployment

### Web Application

Recommended platforms:
- Vercel (Next.js optimized)
- Railway (with Postgres)
- Fly.io

### iOS Application

- Submit to App Store via Xcode
- Configure App Store Connect
- Set up TestFlight for beta testing

## Contributing

1. Create feature branch from main
2. Make changes with clear commit messages
3. Ensure tests pass
4. Submit pull request

## License

[Add your license here]

## Support

For issues or questions:
- GitHub Issues: [repository URL]
- Email: [support email]
- Documentation: [docs URL]

---

Built with ❤️ for makers, tinkerers, and DIY enthusiasts.
