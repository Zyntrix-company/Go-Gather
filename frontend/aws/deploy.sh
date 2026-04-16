#!/usr/bin/env bash
# =============================================================================
# GatherrGo — AWS S3 + CloudFront Deployment Script
# =============================================================================
# Usage:
#   S3_BUCKET=your-bucket-name CF_DISTRIBUTION_ID=EXXXXX ./aws/deploy.sh
#
# Requirements:
#   - AWS CLI configured (aws configure)
#   - jq installed (for JSON parsing, optional)
# =============================================================================

set -euo pipefail

S3_BUCKET="${S3_BUCKET:?Set S3_BUCKET env var}"
CF_DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:?Set CF_DISTRIBUTION_ID env var}"
DIST_DIR="dist"

echo "▶ Building..."
npm run build

echo "▶ Uploading to s3://${S3_BUCKET}..."

# ── index.html — MUST NOT be cached ─────────────────────────────────────────
# Browsers and CloudFront must always fetch the latest index.html so that
# updated JS/CSS chunk hashes are picked up immediately after a deploy.
aws s3 cp "${DIST_DIR}/index.html" "s3://${S3_BUCKET}/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

# ── Hashed JS / CSS assets — cache forever ───────────────────────────────────
# Vite appends a content hash to every chunk filename (e.g. index.a1b2c3d4.js).
# The filename changes on every build, so it's safe to cache for 1 year.
aws s3 sync "${DIST_DIR}/assets" "s3://${S3_BUCKET}/assets" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --delete

# ── sitemap.xml — short cache, correct MIME type ─────────────────────────────
# S3 defaults to application/octet-stream for .xml — must be set explicitly
# so Google and browsers parse it correctly.
aws s3 cp "${DIST_DIR}/sitemap.xml" "s3://${S3_BUCKET}/sitemap.xml" \
  --content-type "application/xml" \
  --cache-control "public, max-age=3600" \
  --metadata-directive REPLACE

# ── robots.txt ───────────────────────────────────────────────────────────────
aws s3 cp "${DIST_DIR}/robots.txt" "s3://${S3_BUCKET}/robots.txt" \
  --content-type "text/plain; charset=utf-8" \
  --cache-control "public, max-age=3600" \
  --metadata-directive REPLACE

# ── Static images / icons (og-image, apple-touch-icon, favicon, logo) ────────
for file in og-image.png apple-touch-icon.png favicon.ico logo.png; do
  if [ -f "${DIST_DIR}/${file}" ]; then
    aws s3 cp "${DIST_DIR}/${file}" "s3://${S3_BUCKET}/${file}" \
      --content-type "image/png" \
      --cache-control "public, max-age=86400" \
      --metadata-directive REPLACE
  fi
done

# favicon.svg
if [ -f "${DIST_DIR}/favicon.svg" ]; then
  aws s3 cp "${DIST_DIR}/favicon.svg" "s3://${S3_BUCKET}/favicon.svg" \
    --content-type "image/svg+xml" \
    --cache-control "public, max-age=86400" \
    --metadata-directive REPLACE
fi

# ── Everything else (fonts, manifests, etc.) ─────────────────────────────────
aws s3 sync "${DIST_DIR}" "s3://${S3_BUCKET}" \
  --exclude "index.html" \
  --exclude "assets/*" \
  --exclude "sitemap.xml" \
  --exclude "robots.txt" \
  --exclude "og-image.png" \
  --exclude "apple-touch-icon.png" \
  --exclude "favicon.ico" \
  --exclude "favicon.svg" \
  --exclude "logo.png" \
  --cache-control "public, max-age=86400" \
  --delete

# ── Remove raw design-export files (not meant to be served) ──────────────────
# Vite copies everything in /public to dist, including the original Frame files.
# og-image.png and apple-touch-icon.png are the correctly-named copies.
aws s3 rm "s3://${S3_BUCKET}/Frame 84.png" --quiet || true
aws s3 rm "s3://${S3_BUCKET}/Frame 85.png" --quiet || true

# ── Invalidate CloudFront cache ───────────────────────────────────────────────
# Invalidate index.html and robots/sitemap (the only files without content hashes).
# Hashed assets never need invalidation — their URLs change on every build.
echo "▶ Invalidating CloudFront distribution ${CF_DISTRIBUTION_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_DISTRIBUTION_ID}" \
  --paths "/index.html" "/robots.txt" "/sitemap.xml" "/*.png" "/*.ico" "/*.svg"

echo "✓ Deploy complete."
