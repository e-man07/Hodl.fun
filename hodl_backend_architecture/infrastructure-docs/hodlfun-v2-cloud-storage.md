# Hodl.fun V2 - Cloud Storage (GCS)

## Table of Contents
1. [Overview](#overview)
2. [Why Cloud Storage](#why-cloud-storage)
3. [Bucket Configuration](#bucket-configuration)
4. [Upload Flow](#upload-flow)
5. [Signed URLs](#signed-urls)
6. [Image Processing](#image-processing)
7. [CDN Integration](#cdn-integration)
8. [NestJS Implementation](#nestjs-implementation)
9. [Security](#security)
10. [Lifecycle Management](#lifecycle-management)
11. [Monitoring & Logging](#monitoring--logging)
12. [Cost Estimation](#cost-estimation)

---

## Overview

### What This Document Covers

This document details how Cloud Storage is used for storing and serving user-uploaded images (token images, user avatars) with CDN delivery.

### Architecture Position

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     IMAGE UPLOAD & DELIVERY FLOW                            │
└────────────────────────────────────────────────────────────────────────────┘

UPLOAD FLOW:
─────────────────────────────────────────────────────────────────────────────

  User                    API Pod                   Cloud Storage
    │                        │                           │
    │  1. Upload image       │                           │
    │  POST /api/upload      │                           │
    │ ──────────────────────►│                           │
    │                        │                           │
    │                        │  2. Process & validate    │
    │                        │  3. Resize image          │
    │                        │                           │
    │                        │  4. Upload to GCS         │
    │                        │ ─────────────────────────►│
    │                        │                           │
    │                        │  5. Return URL            │
    │                        │◄───────────────────────── │
    │                        │                           │
    │  6. Image URL          │                           │
    │◄────────────────────── │                           │
    │                        │                           │


DELIVERY FLOW:
─────────────────────────────────────────────────────────────────────────────

  User                   Cloudflare CDN            Cloud Storage
    │                        │                           │
    │  1. Request image      │                           │
    │  GET /images/xxx.png   │                           │
    │ ──────────────────────►│                           │
    │                        │                           │
    │                        │  2. Check cache           │
    │                        │  ┌─────────────────┐      │
    │                        │  │  Cache HIT?     │      │
    │                        │  └────────┬────────┘      │
    │                        │           │               │
    │                   ┌────┴───────────┴────┐          │
    │                   │                     │          │
    │                   ▼                     ▼          │
    │              Cache HIT            Cache MISS       │
    │                   │                     │          │
    │                   │                     │  3. Fetch│
    │                   │                     │ ────────►│
    │                   │                     │          │
    │                   │                     │◄──────── │
    │                   │                     │          │
    │  4. Return image  │                     │          │
    │◄──────────────────┴─────────────────────┘          │
    │                                                    │
```

### Key Specifications

| Attribute | Value |
|-----------|-------|
| Service | Cloud Storage |
| Storage Class | Standard |
| Location | us-central1 (regional) |
| Access | Private + Signed URLs or Public via CDN |
| CDN | Cloudflare (existing) |
| Max File Size | 5 MB |
| Supported Formats | JPEG, PNG, GIF, WebP |

---

## Why Cloud Storage

### Cloud Storage vs Alternatives

| Aspect | Cloud Storage | S3 | Self-hosted (on GKE) |
|--------|--------------|-----|---------------------|
| **Integration** | Native GCP | Cross-cloud | Manual |
| **Scalability** | Unlimited | Unlimited | Limited |
| **Durability** | 99.999999999% | 99.999999999% | Depends |
| **Cost** | Low | Low | Higher (ops) |
| **CDN Integration** | Easy | Easy | Manual |
| **Maintenance** | Zero | Zero | High |

### Why Cloud Storage for Hodl.fun

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY CLOUD STORAGE IS RIGHT FOR US                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. NATIVE GCP INTEGRATION
─────────────────────────────────────────────────────────────────────────────
   - Same project as GKE, Cloud SQL
   - IAM-based access control
   - Service account authentication
   - No cross-cloud complexity


2. SCALABILITY
─────────────────────────────────────────────────────────────────────────────
   - Handle any number of images
   - No capacity planning needed
   - Automatic scaling


3. DURABILITY & AVAILABILITY
─────────────────────────────────────────────────────────────────────────────
   - 99.999999999% durability (11 nines)
   - 99.95% availability (regional)
   - Data replicated within region


4. COST EFFICIENCY
─────────────────────────────────────────────────────────────────────────────
   - Pay only for storage used
   - Cheap egress via CDN
   - No server costs


5. CDN COMPATIBILITY
─────────────────────────────────────────────────────────────────────────────
   - Works with Cloudflare
   - Or use Cloud CDN
   - Easy cache invalidation
```

---

## Bucket Configuration

### Bucket Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUCKET ARCHITECTURE                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        hodlfun-images (Bucket)                               │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         tokens/                                     │   │
│   │                                                                     │   │
│   │   Token images uploaded by creators                                 │   │
│   │                                                                     │   │
│   │   tokens/0x123abc.png                                               │   │
│   │   tokens/0x456def.png                                               │   │
│   │   tokens/0x789ghi.webp                                              │   │
│   │                                                                     │   │
│   │   Naming: tokens/{token_address}.{ext}                              │   │
│   │   Access: Public (via CDN)                                          │   │
│   │   Cache:  1 year (immutable after upload)                           │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         avatars/                                    │   │
│   │                                                                     │   │
│   │   User profile pictures                                             │   │
│   │                                                                     │   │
│   │   avatars/0xwallet123.png                                           │   │
│   │   avatars/0xwallet456.webp                                          │   │
│   │                                                                     │   │
│   │   Naming: avatars/{wallet_address}.{ext}                            │   │
│   │   Access: Public (via CDN)                                          │   │
│   │   Cache:  1 hour (can be updated)                                   │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         temp/                                       │   │
│   │                                                                     │   │
│   │   Temporary uploads before processing                               │   │
│   │                                                                     │   │
│   │   temp/upload_abc123_1706123456.png                                 │   │
│   │                                                                     │   │
│   │   Naming: temp/upload_{uuid}_{timestamp}.{ext}                      │   │
│   │   Access: Private (signed URLs only)                                │   │
│   │   Lifecycle: Auto-delete after 24 hours                             │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Terraform Configuration

```hcl
# storage.tf

# ═══════════════════════════════════════════════════════════════════════════
# MAIN IMAGES BUCKET
# ═══════════════════════════════════════════════════════════════════════════

resource "google_storage_bucket" "images" {
  name          = "hodlfun-images"
  location      = "US-CENTRAL1"
  storage_class = "STANDARD"
  
  # Prevent accidental deletion
  force_destroy = false
  
  # Uniform bucket-level access (recommended)
  uniform_bucket_level_access = true
  
  # Versioning (optional, for recovery)
  versioning {
    enabled = false  # Not needed for images
  }
  
  # CORS configuration for browser uploads
  cors {
    origin          = ["https://hodlfun.io", "https://www.hodlfun.io"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }
  
  # Lifecycle rules
  lifecycle_rule {
    # Delete temp files after 1 day
    condition {
      age                   = 1
      matches_prefix        = ["temp/"]
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    # Move old versions to Nearline after 30 days (if versioning enabled)
    condition {
      age                   = 30
      num_newer_versions    = 1
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  # Labels
  labels = {
    environment = "production"
    app         = "hodlfun"
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# BUCKET IAM
# ═══════════════════════════════════════════════════════════════════════════

# Public read access for images (served via CDN)
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
  
  # Only for tokens/ and avatars/ prefixes
  condition {
    title       = "public_images_only"
    description = "Allow public access only to tokens and avatars"
    expression  = "resource.name.startsWith('projects/_/buckets/hodlfun-images/objects/tokens/') || resource.name.startsWith('projects/_/buckets/hodlfun-images/objects/avatars/')"
  }
}

# Service account for API pods
resource "google_storage_bucket_iam_member" "api_access" {
  bucket = google_storage_bucket.images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api.email}"
}

# ═══════════════════════════════════════════════════════════════════════════
# SERVICE ACCOUNT
# ═══════════════════════════════════════════════════════════════════════════

resource "google_service_account" "api" {
  account_id   = "hodlfun-api"
  display_name = "Hodl.fun API Service Account"
}

# Workload Identity binding
resource "google_service_account_iam_member" "api_workload_identity" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[default/hodlfun-api-sa]"
}

# ═══════════════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════════════

output "bucket_name" {
  value = google_storage_bucket.images.name
}

output "bucket_url" {
  value = google_storage_bucket.images.url
}
```

### Folder Structure

```
hodlfun-images/
├── tokens/                    # Token images
│   ├── 0x123abc.png
│   ├── 0x456def.webp
│   └── ...
│
├── avatars/                   # User avatars
│   ├── 0xwallet123.png
│   ├── 0xwallet456.webp
│   └── ...
│
├── temp/                      # Temporary uploads (auto-deleted)
│   ├── upload_uuid1_1706123456.png
│   └── ...
│
└── (future expansions)
    ├── banners/              # Token banners
    ├── comments/             # Comment attachments
    └── ...
```

---

## Upload Flow

### Complete Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TOKEN IMAGE UPLOAD FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: User selects image in frontend
═══════════════════════════════════════════════════════════════════════════════

Frontend (React):
  - User clicks "Upload Image"
  - File picker opens
  - User selects image file
  - Client-side validation:
    ✓ File type: image/jpeg, image/png, image/gif, image/webp
    ✓ File size: < 5 MB
    ✓ Dimensions: reasonable (not > 4000x4000)


STEP 2: Frontend sends to API
═══════════════════════════════════════════════════════════════════════════════

POST /api/v1/upload/image
Content-Type: multipart/form-data
Authorization: Bearer <jwt>

Form Data:
  - file: <binary image data>
  - type: "token" | "avatar"


STEP 3: API receives and validates
═══════════════════════════════════════════════════════════════════════════════

API Pod:
  1. Auth check (JWT valid)
  2. File validation:
     - MIME type check (magic bytes, not just extension)
     - Size check (< 5 MB)
     - Malware scan (optional)
  3. If invalid, return 400 Bad Request


STEP 4: API processes image
═══════════════════════════════════════════════════════════════════════════════

Image Processing (Sharp library):
  1. Read image metadata
  2. Strip EXIF data (privacy)
  3. Resize to standard sizes:
     - Token: 400x400 (square, cropped)
     - Avatar: 200x200 (square, cropped)
  4. Convert to WebP (better compression)
  5. Optimize quality (80%)


STEP 5: API uploads to Cloud Storage
═══════════════════════════════════════════════════════════════════════════════

Upload to GCS:
  - Bucket: hodlfun-images
  - Path: temp/upload_{uuid}_{timestamp}.webp
  - Metadata:
    - Content-Type: image/webp
    - Cache-Control: private, max-age=3600
    - x-uploaded-by: {wallet}


STEP 6: API returns temporary URL
═══════════════════════════════════════════════════════════════════════════════

Response:
{
  "success": true,
  "data": {
    "tempUrl": "https://storage.googleapis.com/hodlfun-images/temp/upload_xxx.webp",
    "tempKey": "temp/upload_xxx.webp",
    "expiresAt": "2024-01-26T12:00:00Z"
  }
}


STEP 7: User creates token with image
═══════════════════════════════════════════════════════════════════════════════

POST /api/v1/tokens
{
  "name": "My Token",
  "symbol": "MTK",
  "imageKey": "temp/upload_xxx.webp",  // Temp key from upload
  ...
}


STEP 8: API moves image to permanent location
═══════════════════════════════════════════════════════════════════════════════

On token creation success:
  1. Copy: temp/upload_xxx.webp → tokens/0xnewtoken.webp
  2. Update metadata:
     - Cache-Control: public, max-age=31536000  (1 year)
  3. Delete temp file
  4. Save URL in database


STEP 9: Image served via CDN
═══════════════════════════════════════════════════════════════════════════════

Final URL: https://images.hodlfun.io/tokens/0xnewtoken.webp
            └─────────────────────┘
            Cloudflare CDN subdomain
```

### Upload Sequence Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UPLOAD SEQUENCE DIAGRAM                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User        Frontend       API Pod        GCS          Database
 │             │              │            │              │
 │  Select     │              │            │              │
 │  image      │              │            │              │
 │────────────►│              │            │              │
 │             │              │            │              │
 │             │ Validate     │            │              │
 │             │ client-side  │            │              │
 │             │              │            │              │
 │             │ POST /upload │            │              │
 │             │─────────────►│            │              │
 │             │              │            │              │
 │             │              │ Validate   │              │
 │             │              │ server-side│              │
 │             │              │            │              │
 │             │              │ Process    │              │
 │             │              │ (resize)   │              │
 │             │              │            │              │
 │             │              │ Upload     │              │
 │             │              │───────────►│              │
 │             │              │            │              │
 │             │              │◄───────────│              │
 │             │              │ URL        │              │
 │             │              │            │              │
 │             │◄─────────────│            │              │
 │             │ Temp URL     │            │              │
 │             │              │            │              │
 │◄────────────│              │            │              │
 │ Show        │              │            │              │
 │ preview     │              │            │              │
 │             │              │            │              │
 │ Submit      │              │            │              │
 │ form        │              │            │              │
 │────────────►│              │            │              │
 │             │              │            │              │
 │             │ POST /tokens │            │              │
 │             │─────────────►│            │              │
 │             │              │            │              │
 │             │              │ Move image │              │
 │             │              │───────────►│              │
 │             │              │            │              │
 │             │              │ Save token │              │
 │             │              │────────────┼─────────────►│
 │             │              │            │              │
 │             │◄─────────────│            │              │
 │             │ Token created│            │              │
 │             │              │            │              │
 │◄────────────│              │            │              │
 │ Success     │              │            │              │
 │             │              │            │              │
```

---

## Signed URLs

### When to Use Signed URLs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIGNED URLs vs PUBLIC ACCESS                              │
└─────────────────────────────────────────────────────────────────────────────┘

PUBLIC ACCESS (allUsers)
═══════════════════════════════════════════════════════════════════════════════

Use for:
  - Token images (after approval)
  - User avatars
  - Any content that should be publicly visible

URL format:
  https://storage.googleapis.com/hodlfun-images/tokens/0x123.webp

Pros:
  - Simple URLs
  - CDN cacheable
  - No expiration
  
Cons:
  - Anyone can access
  - Can't revoke access


SIGNED URLs
═══════════════════════════════════════════════════════════════════════════════

Use for:
  - Temporary uploads (before processing)
  - Private content (if any)
  - Upload URLs (letting clients upload directly)

URL format:
  https://storage.googleapis.com/hodlfun-images/temp/xxx.webp
    ?X-Goog-Algorithm=GOOG4-RSA-SHA256
    &X-Goog-Credential=...
    &X-Goog-Date=20240125T120000Z
    &X-Goog-Expires=3600
    &X-Goog-Signature=...

Pros:
  - Time-limited access
  - Can be revoked
  - Fine-grained control
  
Cons:
  - Complex URLs
  - Not CDN cacheable (unique per request)
  - Requires server to generate
```

### Generating Signed URLs

```typescript
// src/upload/upload.service.ts

import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadService {
  private storage: Storage;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.storage = new Storage();
    this.bucket = this.configService.get('GCS_BUCKET');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SIGNED URL FOR DOWNLOAD (Read access)
  // ═══════════════════════════════════════════════════════════════════════
  
  async getSignedDownloadUrl(
    objectPath: string,
    expiresInMinutes: number = 60,
  ): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    };

    const [url] = await this.storage
      .bucket(this.bucket)
      .file(objectPath)
      .getSignedUrl(options);

    return url;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SIGNED URL FOR UPLOAD (Write access)
  // Used for direct browser-to-GCS uploads
  // ═══════════════════════════════════════════════════════════════════════
  
  async getSignedUploadUrl(
    objectPath: string,
    contentType: string,
    expiresInMinutes: number = 15,
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
      contentType,
    };

    const [url] = await this.storage
      .bucket(this.bucket)
      .file(objectPath)
      .getSignedUrl(options);

    return {
      url,
      fields: {
        'Content-Type': contentType,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESUMABLE UPLOAD URL (For large files)
  // ═══════════════════════════════════════════════════════════════════════
  
  async getResumableUploadUrl(
    objectPath: string,
    contentType: string,
  ): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'resumable' as const,
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      contentType,
    };

    const [url] = await this.storage
      .bucket(this.bucket)
      .file(objectPath)
      .getSignedUrl(options);

    return url;
  }
}
```

### Direct Upload Pattern (Advanced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIRECT UPLOAD PATTERN                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Instead of: Client → API → GCS
Use:        Client → API (get signed URL) → GCS (direct upload)

Benefits:
  - Reduces API server load
  - Faster uploads (direct to storage)
  - No memory pressure on API pods

Flow:
─────────────────────────────────────────────────────────────────────────────

1. Client requests signed upload URL
   
   POST /api/v1/upload/request
   { "contentType": "image/png", "size": 1024000 }

2. API validates and returns signed URL
   
   {
     "uploadUrl": "https://storage.googleapis.com/hodlfun-images/...",
     "objectPath": "temp/upload_xxx.png",
     "expiresAt": "2024-01-25T12:15:00Z"
   }

3. Client uploads directly to GCS
   
   PUT {uploadUrl}
   Content-Type: image/png
   <binary data>

4. Client notifies API of completion
   
   POST /api/v1/upload/complete
   { "objectPath": "temp/upload_xxx.png" }

5. API processes (resize, move to final location)


Code Example (Client):
─────────────────────────────────────────────────────────────────────────────

// Step 1: Get signed URL
const { uploadUrl, objectPath } = await fetch('/api/upload/request', {
  method: 'POST',
  body: JSON.stringify({ contentType: file.type, size: file.size }),
}).then(r => r.json());

// Step 2: Upload directly to GCS
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
});

// Step 3: Notify API
await fetch('/api/upload/complete', {
  method: 'POST',
  body: JSON.stringify({ objectPath }),
});
```

---

## Image Processing

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IMAGE PROCESSING PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT IMAGE
    │
    │  Original: user_upload.png
    │  Size: 2.5 MB
    │  Dimensions: 2000x1500
    │  Format: PNG
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: VALIDATION                                                          │
│                                                                             │
│   ✓ Check MIME type (magic bytes)                                          │
│   ✓ Check file size (< 5 MB)                                               │
│   ✓ Check dimensions (< 4000x4000)                                         │
│   ✓ Verify not corrupted                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: SANITIZATION                                                        │
│                                                                             │
│   ✓ Strip EXIF metadata (GPS, camera info, etc.)                           │
│   ✓ Strip ICC color profile (optional, keep for quality)                   │
│   ✓ Remove embedded thumbnails                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: RESIZE                                                              │
│                                                                             │
│   Token images:                                                             │
│   - Target: 400x400 (square)                                               │
│   - Method: Cover (crop to fill)                                           │
│   - Position: Center                                                        │
│                                                                             │
│   Avatars:                                                                  │
│   - Target: 200x200 (square)                                               │
│   - Method: Cover (crop to fill)                                           │
│   - Position: Center                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: FORMAT CONVERSION                                                   │
│                                                                             │
│   Convert to WebP:                                                          │
│   - Quality: 80%                                                            │
│   - Method: 4 (balanced speed/quality)                                      │
│   - Lossless: false                                                         │
│                                                                             │
│   Why WebP:                                                                 │
│   - 25-35% smaller than JPEG                                               │
│   - 26% smaller than PNG                                                   │
│   - Good browser support (95%+)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
OUTPUT IMAGE
    │
    │  Final: 0xtoken123.webp
    │  Size: 35 KB (98% reduction!)
    │  Dimensions: 400x400
    │  Format: WebP
```

### Sharp Implementation

```typescript
// src/upload/image-processor.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fileType from 'file-type';

interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  size: number;
}

@Injectable()
export class ImageProcessorService {
  // Allowed MIME types
  private readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  // Max file size (5 MB)
  private readonly MAX_SIZE = 5 * 1024 * 1024;

  // Max dimensions
  private readonly MAX_DIMENSION = 4000;

  // ═══════════════════════════════════════════════════════════════════════
  // PROCESS TOKEN IMAGE
  // ═══════════════════════════════════════════════════════════════════════

  async processTokenImage(buffer: Buffer): Promise<ProcessedImage> {
    // Validate
    await this.validate(buffer);

    // Process
    const processed = await sharp(buffer)
      // Remove metadata (EXIF, etc.)
      .rotate() // Auto-rotate based on EXIF, then strip
      .withMetadata({ orientation: undefined })
      
      // Resize to 400x400 square
      .resize(400, 400, {
        fit: 'cover',        // Crop to fill
        position: 'center',  // Center the crop
      })
      
      // Convert to WebP
      .webp({
        quality: 80,
        effort: 4,  // Compression effort (0-6)
      })
      
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: processed.data,
      contentType: 'image/webp',
      width: processed.info.width,
      height: processed.info.height,
      size: processed.info.size,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROCESS AVATAR IMAGE
  // ═══════════════════════════════════════════════════════════════════════

  async processAvatarImage(buffer: Buffer): Promise<ProcessedImage> {
    await this.validate(buffer);

    const processed = await sharp(buffer)
      .rotate()
      .withMetadata({ orientation: undefined })
      
      // Smaller size for avatars
      .resize(200, 200, {
        fit: 'cover',
        position: 'center',
      })
      
      .webp({
        quality: 80,
        effort: 4,
      })
      
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: processed.data,
      contentType: 'image/webp',
      width: processed.info.width,
      height: processed.info.height,
      size: processed.info.size,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  private async validate(buffer: Buffer): Promise<void> {
    // Check size
    if (buffer.length > this.MAX_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${this.MAX_SIZE / 1024 / 1024} MB`,
      );
    }

    // Check MIME type (by magic bytes, not extension)
    const type = await fileType.fromBuffer(buffer);
    if (!type || !this.ALLOWED_TYPES.includes(type.mime)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${this.ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Check dimensions
    const metadata = await sharp(buffer).metadata();
    if (
      metadata.width > this.MAX_DIMENSION ||
      metadata.height > this.MAX_DIMENSION
    ) {
      throw new BadRequestException(
        `Image too large. Maximum dimension is ${this.MAX_DIMENSION}px`,
      );
    }

    // Check if image is valid (not corrupted)
    try {
      await sharp(buffer).stats();
    } catch (error) {
      throw new BadRequestException('Invalid or corrupted image file');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATE MULTIPLE SIZES (Optional)
  // ═══════════════════════════════════════════════════════════════════════

  async processWithMultipleSizes(
    buffer: Buffer,
  ): Promise<Map<string, ProcessedImage>> {
    await this.validate(buffer);

    const sizes = [
      { name: 'large', width: 800, height: 800 },
      { name: 'medium', width: 400, height: 400 },
      { name: 'small', width: 200, height: 200 },
      { name: 'thumbnail', width: 100, height: 100 },
    ];

    const results = new Map<string, ProcessedImage>();

    for (const size of sizes) {
      const processed = await sharp(buffer)
        .rotate()
        .withMetadata({ orientation: undefined })
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      results.set(size.name, {
        buffer: processed.data,
        contentType: 'image/webp',
        width: processed.info.width,
        height: processed.info.height,
        size: processed.info.size,
      });
    }

    return results;
  }
}
```

---

## CDN Integration

### Cloudflare CDN Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CDN ARCHITECTURE                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Option A: Cloudflare in front of GCS (Recommended)
═══════════════════════════════════════════════════════════════════════════════

DNS Setup:
  images.hodlfun.io → CNAME → storage.googleapis.com (proxied by Cloudflare)

Flow:
  User → Cloudflare Edge → (cache miss) → Cloud Storage → Cloudflare → User
  User → Cloudflare Edge → (cache hit) → User

Benefits:
  - Same CDN as main app
  - Free caching
  - DDoS protection
  - Easy setup


Option B: Cloud CDN (Alternative)
═══════════════════════════════════════════════════════════════════════════════

Setup:
  - Enable Cloud CDN on a Load Balancer
  - Backend: Cloud Storage bucket

Benefits:
  - Native GCP integration
  - Fine-grained cache control
  - Cache invalidation API

Drawbacks:
  - Additional cost
  - More complex setup
```

### Cloudflare Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN CONFIGURATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

DNS RECORD
═══════════════════════════════════════════════════════════════════════════════

Type:     CNAME
Name:     images
Target:   storage.googleapis.com
Proxy:    Enabled (orange cloud)


PAGE RULES (for images.hodlfun.io/*)
═══════════════════════════════════════════════════════════════════════════════

Rule 1: Cache images aggressively
─────────────────────────────────────────────────────────────────────────────
URL:                  images.hodlfun.io/tokens/*
Cache Level:          Cache Everything
Edge Cache TTL:       1 month
Browser Cache TTL:    1 year


Rule 2: Cache avatars with shorter TTL
─────────────────────────────────────────────────────────────────────────────
URL:                  images.hodlfun.io/avatars/*
Cache Level:          Cache Everything
Edge Cache TTL:       1 hour
Browser Cache TTL:    1 hour


CACHE RULES (new Cloudflare feature)
═══════════════════════════════════════════════════════════════════════════════

Expression: (http.host eq "images.hodlfun.io")

Then:
  - Cache eligibility: Eligible for cache
  - Edge TTL: Use origin Cache-Control header
  - Browser TTL: Use origin Cache-Control header


TRANSFORM RULES (Optional - URL rewriting)
═══════════════════════════════════════════════════════════════════════════════

Rewrite URL from:
  images.hodlfun.io/tokens/0x123.webp

To:
  storage.googleapis.com/hodlfun-images/tokens/0x123.webp
```

### Cache Headers in GCS

```typescript
// Set cache headers when uploading

async uploadToGCS(
  buffer: Buffer,
  path: string,
  contentType: string,
  isPublic: boolean = true,
): Promise<string> {
  const file = this.storage.bucket(this.bucket).file(path);

  await file.save(buffer, {
    metadata: {
      contentType,
      // Cache control header
      cacheControl: isPublic
        ? 'public, max-age=31536000'  // 1 year for public images
        : 'private, max-age=3600',     // 1 hour for temp files
    },
  });

  // Make public if needed
  if (isPublic) {
    await file.makePublic();
  }

  return `https://images.hodlfun.io/${path}`;
}
```

### Cache Invalidation

```typescript
// Invalidate Cloudflare cache when image is updated

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CdnService {
  private readonly cloudflareApiToken: string;
  private readonly cloudflareZoneId: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudflareApiToken = this.configService.get('CLOUDFLARE_API_TOKEN');
    this.cloudflareZoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PURGE SINGLE URL
  // ═══════════════════════════════════════════════════════════════════════
  
  async purgeUrl(url: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [url],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to purge cache: ${response.statusText}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PURGE BY PREFIX (e.g., all token images)
  // ═══════════════════════════════════════════════════════════════════════
  
  async purgeByPrefix(prefix: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefixes: [prefix],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to purge cache: ${response.statusText}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PURGE WHEN AVATAR UPDATED
  // ═══════════════════════════════════════════════════════════════════════
  
  async onAvatarUpdated(walletAddress: string): Promise<void> {
    const url = `https://images.hodlfun.io/avatars/${walletAddress}.webp`;
    await this.purgeUrl(url);
  }
}
```

---

## NestJS Implementation

### Upload Module

```typescript
// src/upload/upload.module.ts

import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { ImageProcessorService } from './image-processor.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    ImageProcessorService,
    StorageService,
  ],
  exports: [UploadService, StorageService],
})
export class UploadModule {}
```

### Upload Controller

```typescript
// src/upload/upload.controller.ts

import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadService } from './upload.service';

@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE (Standard flow - through API)
  // ═══════════════════════════════════════════════════════════════════════

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'token' | 'avatar',
    @CurrentUser() user: { wallet: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!['token', 'avatar'].includes(type)) {
      throw new BadRequestException('Invalid type. Must be "token" or "avatar"');
    }

    const result = await this.uploadService.uploadImage(
      file.buffer,
      type,
      user.wallet,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REQUEST SIGNED UPLOAD URL (Direct upload flow)
  // ═══════════════════════════════════════════════════════════════════════

  @Post('request')
  @UseGuards(JwtAuthGuard)
  async requestUploadUrl(
    @Body() body: { contentType: string; size: number; type: 'token' | 'avatar' },
    @CurrentUser() user: { wallet: string },
  ) {
    // Validate
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(body.contentType)) {
      throw new BadRequestException('Invalid content type');
    }

    if (body.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum 5 MB');
    }

    const result = await this.uploadService.getSignedUploadUrl(
      body.contentType,
      body.type,
      user.wallet,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLETE UPLOAD (After direct upload)
  // ═══════════════════════════════════════════════════════════════════════

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  async completeUpload(
    @Body() body: { objectPath: string; type: 'token' | 'avatar' },
    @CurrentUser() user: { wallet: string },
  ) {
    const result = await this.uploadService.completeUpload(
      body.objectPath,
      body.type,
      user.wallet,
    );

    return {
      success: true,
      data: result,
    };
  }
}
```

### Upload Service

```typescript
// src/upload/upload.service.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { ImageProcessorService } from './image-processor.service';
import { StorageService } from './storage.service';

interface UploadResult {
  url: string;
  tempKey?: string;
  expiresAt?: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly storage: StorageService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD IMAGE (Through API)
  // ═══════════════════════════════════════════════════════════════════════

  async uploadImage(
    buffer: Buffer,
    type: 'token' | 'avatar',
    uploaderWallet: string,
  ): Promise<UploadResult> {
    this.logger.log(`Processing ${type} image upload from ${uploaderWallet}`);

    // Process image based on type
    const processed = type === 'token'
      ? await this.imageProcessor.processTokenImage(buffer)
      : await this.imageProcessor.processAvatarImage(buffer);

    // Generate temp path
    const uuid = uuidv4();
    const timestamp = Date.now();
    const tempPath = `temp/upload_${uuid}_${timestamp}.webp`;

    // Upload to temp location
    await this.storage.upload(
      processed.buffer,
      tempPath,
      processed.contentType,
      {
        uploadedBy: uploaderWallet,
        uploadedAt: new Date().toISOString(),
        type,
      },
      false, // Not public yet
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      url: await this.storage.getSignedUrl(tempPath, 60), // 1 hour signed URL
      tempKey: tempPath,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET SIGNED UPLOAD URL (For direct upload)
  // ═══════════════════════════════════════════════════════════════════════

  async getSignedUploadUrl(
    contentType: string,
    type: 'token' | 'avatar',
    uploaderWallet: string,
  ): Promise<{
    uploadUrl: string;
    objectPath: string;
    expiresAt: string;
  }> {
    const uuid = uuidv4();
    const timestamp = Date.now();
    const extension = contentType.split('/')[1];
    const objectPath = `temp/direct_${uuid}_${timestamp}.${extension}`;

    const uploadUrl = await this.storage.getSignedUploadUrl(
      objectPath,
      contentType,
      15, // 15 minutes
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      uploadUrl,
      objectPath,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLETE UPLOAD (Process and move to final location)
  // ═══════════════════════════════════════════════════════════════════════

  async completeUpload(
    tempPath: string,
    type: 'token' | 'avatar',
    uploaderWallet: string,
  ): Promise<{ url: string; key: string }> {
    // Verify temp file exists and belongs to user
    if (!tempPath.startsWith('temp/')) {
      throw new BadRequestException('Invalid temp path');
    }

    // Download temp file
    const buffer = await this.storage.download(tempPath);

    // Process image
    const processed = type === 'token'
      ? await this.imageProcessor.processTokenImage(buffer)
      : await this.imageProcessor.processAvatarImage(buffer);

    // Generate final path (will be set when token/user is created)
    // For now, keep in temp with processed flag
    const uuid = uuidv4();
    const finalTempPath = `temp/processed_${uuid}.webp`;

    await this.storage.upload(
      processed.buffer,
      finalTempPath,
      processed.contentType,
      {
        uploadedBy: uploaderWallet,
        processedAt: new Date().toISOString(),
        type,
        ready: 'true',
      },
      false,
    );

    // Delete original temp file
    await this.storage.delete(tempPath);

    return {
      url: await this.storage.getSignedUrl(finalTempPath, 60),
      key: finalTempPath,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FINALIZE IMAGE (Move from temp to permanent)
  // Called when token/user is actually created
  // ═══════════════════════════════════════════════════════════════════════

  async finalizeImage(
    tempKey: string,
    finalPath: string,
  ): Promise<string> {
    if (!tempKey.startsWith('temp/')) {
      throw new BadRequestException('Invalid temp key');
    }

    // Copy to final location with public access
    await this.storage.copy(tempKey, finalPath, true);

    // Delete temp file
    await this.storage.delete(tempKey);

    // Return CDN URL
    const cdnDomain = this.configService.get('CDN_DOMAIN', 'images.hodlfun.io');
    return `https://${cdnDomain}/${finalPath}`;
  }
}
```

### Storage Service

```typescript
// src/upload/storage.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.storage = new Storage();
    this.bucket = this.configService.get('GCS_BUCKET');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════════════════════════════════

  async upload(
    buffer: Buffer,
    path: string,
    contentType: string,
    metadata: Record<string, string> = {},
    isPublic: boolean = false,
  ): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(path);

    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: isPublic
          ? 'public, max-age=31536000' // 1 year
          : 'private, max-age=3600',   // 1 hour
        metadata, // Custom metadata
      },
    });

    if (isPublic) {
      await file.makePublic();
    }

    this.logger.debug(`Uploaded ${path} (${buffer.length} bytes)`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════════════════════════════

  async download(path: string): Promise<Buffer> {
    const file = this.storage.bucket(this.bucket).file(path);
    const [buffer] = await file.download();
    return buffer;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════

  async delete(path: string): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(path);
    await file.delete({ ignoreNotFound: true });
    this.logger.debug(`Deleted ${path}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COPY (Move from temp to final)
  // ═══════════════════════════════════════════════════════════════════════

  async copy(
    sourcePath: string,
    destPath: string,
    makePublic: boolean = true,
  ): Promise<void> {
    const sourceFile = this.storage.bucket(this.bucket).file(sourcePath);
    const destFile = this.storage.bucket(this.bucket).file(destPath);

    await sourceFile.copy(destFile);

    // Update metadata for final location
    await destFile.setMetadata({
      cacheControl: makePublic
        ? 'public, max-age=31536000'
        : 'private, max-age=3600',
    });

    if (makePublic) {
      await destFile.makePublic();
    }

    this.logger.debug(`Copied ${sourcePath} to ${destPath}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EXISTS
  // ═══════════════════════════════════════════════════════════════════════

  async exists(path: string): Promise<boolean> {
    const file = this.storage.bucket(this.bucket).file(path);
    const [exists] = await file.exists();
    return exists;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET SIGNED URL (Read)
  // ═══════════════════════════════════════════════════════════════════════

  async getSignedUrl(path: string, expiresInMinutes: number = 60): Promise<string> {
    const file = this.storage.bucket(this.bucket).file(path);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return url;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET SIGNED UPLOAD URL (Write)
  // ═══════════════════════════════════════════════════════════════════════

  async getSignedUploadUrl(
    path: string,
    contentType: string,
    expiresInMinutes: number = 15,
  ): Promise<string> {
    const file = this.storage.bucket(this.bucket).file(path);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
      contentType,
    });

    return url;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET PUBLIC URL
  // ═══════════════════════════════════════════════════════════════════════

  getPublicUrl(path: string): string {
    const cdnDomain = this.configService.get('CDN_DOMAIN', 'images.hodlfun.io');
    return `https://${cdnDomain}/${path}`;
  }
}
```

---

## Security

### Security Measures

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY MEASURES                                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. FILE TYPE VALIDATION
═══════════════════════════════════════════════════════════════════════════════

❌ Bad: Trust file extension
   file.png → Could be malware renamed to .png

✅ Good: Check magic bytes
   Read first bytes of file to verify actual type
   
   PNG:  89 50 4E 47 0D 0A 1A 0A
   JPEG: FF D8 FF
   GIF:  47 49 46 38
   WebP: 52 49 46 46 ... 57 45 42 50


2. SIZE LIMITS
═══════════════════════════════════════════════════════════════════════════════

Multer limit:     5 MB
Nginx limit:      10 MB (buffer)
Dimension limit:  4000x4000 pixels

Why: Prevent DoS via large file processing


3. STRIP METADATA (EXIF)
═══════════════════════════════════════════════════════════════════════════════

EXIF data can contain:
  - GPS coordinates (privacy risk!)
  - Camera model
  - Timestamps
  - Thumbnails (could contain different image)

Always strip before storing.


4. CONTENT SECURITY
═══════════════════════════════════════════════════════════════════════════════

Serve images with:
  Content-Type: image/webp (or appropriate)
  X-Content-Type-Options: nosniff
  Content-Disposition: inline

Prevents browsers from executing as HTML/JS.


5. ACCESS CONTROL
═══════════════════════════════════════════════════════════════════════════════

Temp files:     Private (signed URLs only)
Final images:   Public (via CDN)
Upload:         Authenticated users only

IAM:
  - API pods: storage.objectAdmin
  - Public: storage.objectViewer (tokens/, avatars/ only)


6. RATE LIMITING
═══════════════════════════════════════════════════════════════════════════════

Uploads per user:
  - Token images: 1 per token creation
  - Avatars: 5 per hour
  
Prevents abuse and storage costs.
```

### Security Implementation

```typescript
// src/upload/guards/upload-rate-limit.guard.ts

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class UploadRateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const type = request.body?.type || 'image';

    // Different limits for different upload types
    const limits = {
      avatar: { max: 5, window: 3600 },    // 5 per hour
      token: { max: 10, window: 86400 },   // 10 per day
      default: { max: 20, window: 86400 }, // 20 per day
    };

    const limit = limits[type] || limits.default;
    const key = `upload:${user.wallet}:${type}`;

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, limit.window);
    }

    if (current > limit.max) {
      const ttl = await this.redis.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Upload limit exceeded. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
```

```typescript
// src/upload/validators/file-type.validator.ts

import { FileValidator } from '@nestjs/common';
import * as fileType from 'file-type';

export class MagicBytesValidator extends FileValidator {
  private readonly allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  async isValid(file: Express.Multer.File): Promise<boolean> {
    if (!file || !file.buffer) {
      return false;
    }

    const type = await fileType.fromBuffer(file.buffer);
    
    if (!type) {
      return false;
    }

    return this.allowedTypes.includes(type.mime);
  }

  buildErrorMessage(): string {
    return `Invalid file type. Allowed: ${this.allowedTypes.join(', ')}`;
  }
}
```

---

## Lifecycle Management

### Lifecycle Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIFECYCLE MANAGEMENT                                      │
└─────────────────────────────────────────────────────────────────────────────┘

TEMP FILES (temp/)
═══════════════════════════════════════════════════════════════════════════════

Rule: Delete after 24 hours

Why:
  - Uploads that were never used
  - Failed token creations
  - Abandoned form submissions

Config:
  lifecycle_rule {
    condition {
      age = 1
      matches_prefix = ["temp/"]
    }
    action {
      type = "Delete"
    }
  }


ORPHAN CLEANUP (Worker Job)
═══════════════════════════════════════════════════════════════════════════════

In addition to lifecycle rules, run a cleanup job:

1. List all files in tokens/ and avatars/
2. Cross-reference with database
3. Delete files not referenced by any token/user

Why:
  - Tokens that were deleted
  - Users that changed avatars
  - Database inconsistencies

Schedule: Daily at 04:00 UTC


VERSION CLEANUP (If versioning enabled)
═══════════════════════════════════════════════════════════════════════════════

Rule: Move old versions to Nearline after 30 days

Config:
  lifecycle_rule {
    condition {
      age = 30
      num_newer_versions = 1
    }
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
```

### Cleanup Worker Job

```typescript
// src/worker/processors/storage-cleanup.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { StorageService } from '../../upload/storage.service';
import { TokenRepository } from '../../tokens/token.repository';
import { UserRepository } from '../../users/user.repository';

@Processor('cleanup')
export class StorageCleanupProcessor {
  private readonly logger = new Logger(StorageCleanupProcessor.name);

  constructor(
    private readonly storage: StorageService,
    private readonly tokenRepository: TokenRepository,
    private readonly userRepository: UserRepository,
  ) {}

  @Process('cleanup_orphan_images')
  async handleCleanupOrphanImages(job: Job): Promise<void> {
    this.logger.log('Starting orphan image cleanup');

    let deletedCount = 0;

    // Cleanup orphan token images
    const tokenImages = await this.storage.listFiles('tokens/');
    const validTokenAddresses = new Set(
      (await this.tokenRepository.findAllAddresses()).map(a => a.toLowerCase()),
    );

    for (const file of tokenImages) {
      const address = file.name.replace('tokens/', '').replace('.webp', '');
      if (!validTokenAddresses.has(address.toLowerCase())) {
        await this.storage.delete(file.name);
        deletedCount++;
        this.logger.debug(`Deleted orphan token image: ${file.name}`);
      }
    }

    // Cleanup orphan avatars
    const avatarImages = await this.storage.listFiles('avatars/');
    const validWallets = new Set(
      (await this.userRepository.findAllWallets()).map(w => w.toLowerCase()),
    );

    for (const file of avatarImages) {
      const wallet = file.name.replace('avatars/', '').replace('.webp', '');
      if (!validWallets.has(wallet.toLowerCase())) {
        await this.storage.delete(file.name);
        deletedCount++;
        this.logger.debug(`Deleted orphan avatar: ${file.name}`);
      }
    }

    this.logger.log(`Cleanup complete. Deleted ${deletedCount} orphan images.`);
  }
}
```

---

## Monitoring & Logging

### Key Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STORAGE MONITORING                                        │
└─────────────────────────────────────────────────────────────────────────────┘

STORAGE METRICS (Cloud Monitoring)
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold     Description
─────────────────────────────────────────────────────────────────────────────
storage.googleapis.com/
  storage/total_bytes           > 50 GB            Total storage used
  storage/object_count          > 100,000          Number of objects
  api/request_count             Spike detection    API requests
  network/sent_bytes            Cost monitoring    Egress traffic


APPLICATION METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Description
─────────────────────────────────────────────────────────────────────────────
upload_total                    Total uploads (by type)
upload_errors                   Failed uploads (by reason)
upload_duration_seconds         Processing time histogram
upload_size_bytes               File size histogram
image_processing_duration       Sharp processing time


AUDIT LOGGING
═══════════════════════════════════════════════════════════════════════════════

Enable Cloud Audit Logs for:
  - Data access (reads)
  - Admin activity (deletes, permission changes)

Useful for:
  - Security investigation
  - Compliance
  - Cost attribution
```

### Application Logging

```typescript
// src/upload/upload.service.ts

async uploadImage(
  buffer: Buffer,
  type: 'token' | 'avatar',
  uploaderWallet: string,
): Promise<UploadResult> {
  const startTime = Date.now();
  
  try {
    // ... processing ...
    
    this.logger.log({
      message: 'Image uploaded successfully',
      type,
      uploaderWallet,
      originalSize: buffer.length,
      processedSize: processed.buffer.length,
      compressionRatio: ((1 - processed.buffer.length / buffer.length) * 100).toFixed(1) + '%',
      processingTime: Date.now() - startTime,
    });
    
    // Metrics (if using Prometheus)
    this.metrics.uploadTotal.inc({ type, status: 'success' });
    this.metrics.uploadDuration.observe({ type }, (Date.now() - startTime) / 1000);
    this.metrics.uploadSize.observe({ type }, processed.buffer.length);
    
    return result;
  } catch (error) {
    this.logger.error({
      message: 'Image upload failed',
      type,
      uploaderWallet,
      error: error.message,
      processingTime: Date.now() - startTime,
    });
    
    this.metrics.uploadTotal.inc({ type, status: 'error' });
    
    throw error;
  }
}
```

---

## Cost Estimation

### Monthly Cost Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUD STORAGE COST ESTIMATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

ASSUMPTIONS (Year 1)
═══════════════════════════════════════════════════════════════════════════════

Tokens created:       10,000
Average token image:  50 KB (after processing)
Users with avatars:   5,000
Average avatar:       20 KB

Total storage:        10,000 × 50 KB + 5,000 × 20 KB = 600 MB
With temp files:      ~1 GB


STORAGE COSTS
═══════════════════════════════════════════════════════════════════════════════

Standard storage (us-central1):  $0.020/GB/month

Year 1:
  1 GB × $0.020 = $0.02/month

Year 3 (growth):
  10 GB × $0.020 = $0.20/month

Basically negligible!


OPERATIONS COSTS
═══════════════════════════════════════════════════════════════════════════════

Class A (writes):  $0.05 per 10,000 operations
Class B (reads):   $0.004 per 10,000 operations

Estimated monthly:
  Writes: 1,000 uploads × $0.05/10K = $0.005
  Reads:  100,000 requests × $0.004/10K = $0.04

Total operations: ~$0.05/month


EGRESS COSTS (Without CDN)
═══════════════════════════════════════════════════════════════════════════════

GCS egress: $0.12/GB (to internet)

If serving 1 million image requests:
  1M × 50 KB = 50 GB
  50 GB × $0.12 = $6/month

BUT: With Cloudflare CDN, most requests are cached!
Estimated actual GCS egress: 5 GB × $0.12 = $0.60/month


TOTAL ESTIMATED COST
═══════════════════════════════════════════════════════════════════════════════

Component                Monthly Cost (Year 1)
─────────────────────────────────────────────────────────────────────────────
Storage                  $0.02
Operations               $0.05
Egress (with CDN)        $0.60
─────────────────────────────────────────────────────────────────────────────
TOTAL                    ~$1/month

Note: Cloud Storage is extremely cost-effective for image hosting!
Most of the cost is in egress, which CDN eliminates.
```

### Cost Optimization Tips

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COST OPTIMIZATION                                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. USE CDN (Critical!)
─────────────────────────────────────────────────────────────────────────────
   Without CDN: $6/month for 50 GB egress
   With CDN:    $0.60/month (90% cache hit rate)
   
   Cloudflare free tier handles most traffic!


2. COMPRESS IMAGES
─────────────────────────────────────────────────────────────────────────────
   Original PNG:   500 KB
   Processed WebP: 50 KB (90% smaller)
   
   Less storage, less egress, faster loading!


3. CLEANUP UNUSED FILES
─────────────────────────────────────────────────────────────────────────────
   - Lifecycle rules for temp files
   - Orphan cleanup job
   - Don't store multiple sizes unless needed


4. RIGHT-SIZE DIMENSIONS
─────────────────────────────────────────────────────────────────────────────
   Token images: 400x400 (not 1000x1000)
   Avatars: 200x200 (not 500x500)
   
   Users never see them larger anyway.


5. REGIONAL STORAGE
─────────────────────────────────────────────────────────────────────────────
   Use regional (us-central1) not multi-region
   Cheaper and latency doesn't matter with CDN
```

---

## Summary

### Architecture Overview

```
Upload Flow:
  User → API Pod → Process (Sharp) → Cloud Storage (temp/) → Final (tokens/)

Delivery Flow:
  User → Cloudflare CDN → (cache miss) → Cloud Storage → Cloudflare → User
```

### Key Configuration

| Setting | Value |
|---------|-------|
| Bucket | hodlfun-images |
| Location | us-central1 |
| Storage Class | Standard |
| Access | Public (tokens/, avatars/) via CDN |
| Max File Size | 5 MB |
| Output Format | WebP |
| Token Image Size | 400x400 |
| Avatar Size | 200x200 |

### Folder Structure

| Folder | Purpose | Access | Cache |
|--------|---------|--------|-------|
| `tokens/` | Token images | Public | 1 year |
| `avatars/` | User avatars | Public | 1 hour |
| `temp/` | Temporary uploads | Private | Auto-delete 24h |

### Security Checklist

- [x] Magic byte validation (not just extension)
- [x] Size limits (5 MB)
- [x] Dimension limits (4000x4000)
- [x] EXIF stripping
- [x] Authentication required for upload
- [x] Rate limiting
- [x] Proper Content-Type headers

### Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Storage (1 GB) | $0.02 |
| Operations | $0.05 |
| Egress (with CDN) | $0.60 |
| **Total** | **~$1/month** |

### Files to Create

| File | Purpose |
|------|---------|
| `terraform/storage.tf` | Bucket infrastructure |
| `src/upload/upload.module.ts` | NestJS module |
| `src/upload/upload.controller.ts` | Upload endpoints |
| `src/upload/upload.service.ts` | Upload logic |
| `src/upload/storage.service.ts` | GCS operations |
| `src/upload/image-processor.service.ts` | Sharp processing |
| `src/upload/guards/upload-rate-limit.guard.ts` | Rate limiting |
