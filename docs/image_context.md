# Image Handling Context — GatherGo

> Feed this file to Claude when working on any image upload, display, or deletion feature in the app.

---

## Architecture Overview

```
App (React Native)
    │
    ├── multipart/form-data POST ──► Express API (multer memory storage)
    │                                       │
    │                                       ▼
    │                               upload.middleware.js
    │                               (MIME magic-byte validation)
    │                                       │
    │                                       ▼
    │                               s3.util.js → AWS S3 (PutObjectCommand)
    │                                       │
    │                                       ▼
    │                               DB: store file_url + s3_key
    │
    └── GET image ──────────────────► CloudFront CDN → S3 (via OAC)
                                      OR presigned S3 URL (1hr expiry)
```

---

## Environment Variables (Backend)

| Variable | Purpose |
|---|---|
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_CLOUDFRONT_DOMAIN` | CF domain without `https://`, e.g. `d123abc.cloudfront.net` |
| `AWS_REGION` | Default: `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |

**Key files**: `backend/src/config/index.js`, `backend/src/config/aws.js`

---

## S3 Key Naming Conventions

All S3 keys follow a predictable pattern. Filenames are sanitized (lowercase, spaces→hyphens, special chars stripped) before use.

| Content Type | S3 Key Pattern |
|---|---|
| Trip photos | `trips/{tripId}/photos/{uuid}-{sanitized-filename}` |
| Trip activity photos | `trips/{tripId}/activities/{activityId}/{uuid}-{sanitized-filename}` |
| Event photos | `events/{eventId}/photos/{uuid}-{sanitized-filename}` |
| Trip docs | `trips/{tripId}/docs/{uuid}-{sanitized-filename}` |
| Event docs | `events/{eventId}/docs/{uuid}-{sanitized-filename}` |
| User avatars | `avatars/{uuid}{ext}` |

---

## Upload Flow (Step by Step)

1. **App** sends `multipart/form-data` POST with files
2. **Multer** buffers file in RAM (`memoryStorage`) — no disk writes
3. **`validateMimeFromBuffer`** checks magic bytes (not Content-Type header) to prevent spoofing:
   - JPEG: `0xFF 0xD8 0xFF`
   - PNG: `0x89 0x50 0x4E 0x47`
   - HEIC/HEIF: `ftyp` at byte offset 4
   - MP4/MOV: box headers
4. **Service layer** generates UUID + sanitized S3 key
5. **`uploadToS3(buffer, key, mimeType)`** calls AWS SDK `PutObjectCommand`
6. **URL returned**: CloudFront URL if `AWS_CLOUDFRONT_DOMAIN` set, else direct S3 URL
7. **DB insert**: stores both `file_url` (permanent CDN/S3 URL) and `s3_key` (for deletion)

**Key files**:
- `backend/src/utils/s3.util.js` — `uploadToS3`, `deleteFromS3`, `batchDeleteFromS3`, `getPresignedDownloadUrl`, `sanitiseFilename`
- `backend/src/middleware/upload.middleware.js` — multer config, MIME validation, error handling
- `backend/src/modules/shared/photos/photos.service.js` — photo upload/fetch/delete logic
- `backend/src/modules/shared/docs/docs.service.js` — doc upload/fetch/delete logic
- `backend/src/modules/users/service.js` (lines 156–205) — avatar upload

---

## File Size & Type Limits

| Upload Type | Max Size | Accepted Types |
|---|---|---|
| `photoUpload` | 50 MB | JPEG, PNG, HEIC, HEIF, MP4, MOV |
| `docUpload` | 15 MB | PDF, Office docs, images, text |
| `avatarUpload` | 10 MB | JPEG, PNG, WebP, GIF |
| Activity photos | 50 MB | JPEG, PNG, HEIC, HEIF (max 5 per activity) |

---

## URL Strategy: CloudFront vs Presigned S3

This is the most important pattern to understand when displaying images:

### When `AWS_CLOUDFRONT_DOMAIN` is set (production)
- `uploadToS3` returns: `https://{CF_DOMAIN}/{s3_key}`
- This **permanent URL** is stored directly in `file_url` column in DB
- When fetching photos, **no presigning needed** — just return `file_url`
- S3 bucket blocks direct public access; CloudFront has access via OAC (Origin Access Control)

### When `AWS_CLOUDFRONT_DOMAIN` is NOT set (local dev)
- `uploadToS3` returns: `https://{bucket}.s3.{region}.amazonaws.com/{s3_key}`
- When fetching, `getPresignedDownloadUrl(s3_key, 3600)` generates a **1-hour signed URL**
- `file_url` in DB contains the unsigned S3 URL; the presigned URL is generated at read time

### In the app: always use `url` field (not `fileUrl`)
The API response for photos has two fields:
- `fileUrl` — the permanent CDN/S3 URL stored in DB (may be unsigned S3 URL in dev)
- `url` — the displayable URL (presigned if no CF, same as `fileUrl` if CF configured)

**Always use `url` for `<Image source>` tags in the app.**

---

## Database Schema

### `photos` table
```sql
id          UUID PRIMARY KEY
parent_type VARCHAR(10)   -- 'trip' or 'event'
parent_id   UUID          -- trip or event id
uploaded_by UUID          -- references users(id)
file_url    TEXT          -- permanent CDN or S3 URL
s3_key      TEXT          -- S3 object key (needed for deletion)
caption     TEXT
mime_type   VARCHAR(100)
activity_id UUID          -- non-null for activity photos
created_at  TIMESTAMPTZ
```

### `docs` table
```sql
id              UUID PRIMARY KEY
parent_type     VARCHAR(10)   -- 'trip' or 'event'
parent_id       UUID
uploaded_by     UUID
file_name       VARCHAR(255)  -- original filename shown to user
file_url        TEXT          -- permanent URL
s3_key          TEXT
file_size_bytes BIGINT
mime_type       VARCHAR(100)
created_at      TIMESTAMPTZ
```

### `profiles` table (avatar)
```sql
user_id    UUID PRIMARY KEY
avatar_url VARCHAR(512)    -- permanent CDN/S3 URL
```

### `trips` and `events` tables (banner)
```sql
banner_image_url    TEXT     -- permanent CDN/S3 URL
banner_crop_fraction JSONB   -- {"imgFracX":0.5,"imgFracY":0.3,"imgFracW":1.0,"imgFracH":0.6}
```
`banner_crop_fraction` is used by the app to crop the banner image for display. It represents fractional coordinates of the visible crop region within the original image.

---

## API Endpoints

### Upload

| Method | Endpoint | Field Name | Notes |
|---|---|---|---|
| `POST` | `/trips/:id/photos` | `photos` (array) | trip member required |
| `POST` | `/trips/:id/activities/:actId/photos` | `photos` (array, max 5) | trip member required |
| `POST` | `/events/:eventId/photos` | `photos` (array) | event member required |
| `POST` | `/trips/:id/docs` | `file` (single) | max 50 docs per trip |
| `POST` | `/events/:eventId/docs` | `file` (single) | event member required |
| `PUT` | `/users/photo` | `photo` (single) | replaces current avatar |

### Fetch

| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/trips/:id/photos?page=1&limit=30` | paginated |
| `GET` | `/trips/:id/activities/:actId/photos` | |
| `GET` | `/events/:eventId/photos` | |
| `GET` | `/trips/:id/docs` | includes presigned download URLs |
| `GET` | `/users/:userId/photos` | grouped by trip/event/activity |
| `GET` | `/users/:userId/gallery` | trip+event summaries with banner URLs |

### Delete

| Method | Endpoint | Notes |
|---|---|---|
| `DELETE` | `/trips/:id/photos/:photoId` | deletes from S3 + DB |
| `DELETE` | `/events/:eventId/photos/:photoId` | deletes from S3 + DB |
| `DELETE` | `/trips/:id/docs/:docId` | deletes from S3 + DB |
| `DELETE` | `/events/:eventId/docs/:docId` | deletes from S3 + DB |

---

## Image Deletion

When deleting a photo/doc:
1. Fetch `s3_key` from DB first
2. Call `deleteFromS3(key)` — uses `DeleteObjectCommand`
3. Delete DB record
4. For bulk deletes: `batchDeleteFromS3(keys[])` handles up to 1000 per call

**Never delete the DB record without also deleting the S3 object** — orphaned S3 objects cost money and can't be recovered without listing the bucket.

---

## No Image Processing (Important)

The backend does **zero image transformation**:
- No resizing or thumbnailing
- No compression
- No format conversion (HEIC stays HEIC, etc.)
- Images are stored at original size and quality

If you need to display a thumbnail, do it client-side (e.g. `resizeMode`, `width`/`height` props). Full resolution is always what's in S3.

---

## Best Practices for App-Side Implementation

### Uploading
```javascript
// Always use multipart/form-data
const formData = new FormData();
formData.append('photos', {
  uri: file.uri,
  name: file.fileName || 'photo.jpg',
  type: file.mimeType || 'image/jpeg',
});
// Send with Content-Type: multipart/form-data header
```

### Displaying
```javascript
// ALWAYS use `url` not `fileUrl` — it's presigned in dev, CF URL in prod
<Image source={{ uri: photo.url }} />

// For avatars:
<Image source={{ uri: user.avatarUrl }} />

// For banners:
<Image source={{ uri: trip.bannerImageUrl }} />
```

### Handling HEIC (iOS)
- Backend accepts HEIC/HEIF natively — no client-side conversion needed
- However, React Native `<Image>` may not render HEIC on Android. Consider converting to JPEG client-side before upload if supporting both platforms for display.

### Caching
- CloudFront URLs are permanent — safe to cache indefinitely in the app
- Presigned S3 URLs expire in **1 hour** — do NOT cache these; always fetch fresh from API

### Error Handling
- `FILE_TOO_LARGE` → 400 error code from multer — show user-friendly size limit message
- Network failure mid-upload → S3 `PutObjectCommand` is atomic; partial uploads don't persist
- 403 on image URL → likely expired presigned URL (dev only); re-fetch from API

### Banner Crop Fraction
```javascript
// Apply banner_crop_fraction when rendering banners:
// imgFracX, imgFracY = top-left corner of crop (0–1 scale of image dimensions)
// imgFracW, imgFracH = width/height of crop region (0–1 scale)
// Use with a fixed-height banner container and calculate pixel offsets
```

---

## Security Notes

- MIME types validated via **magic bytes** server-side — client Content-Type is not trusted
- S3 bucket has **no public access** — all reads go through CloudFront (OAC) or presigned URLs
- Trip/event photo access gated by **member middleware** — non-members get 403
- Filenames sanitized before use as S3 keys — prevents path traversal
- No user-controlled content in S3 key prefixes — IDs are UUIDs generated server-side
