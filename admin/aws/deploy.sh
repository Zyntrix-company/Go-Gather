#!/usr/bin/env bash
# =============================================================================
# GatherrGo Admin — AWS S3 + CloudFront Deployment Script
# =============================================================================
# Usage:
#   S3_BUCKET=gatherrgo-admin CF_DISTRIBUTION_ID=EXXXXX ./aws/deploy.sh
#
# Requirements:
#   - AWS CLI configured (aws configure)
# =============================================================================

set -euo pipefail

S3_BUCKET="${S3_BUCKET:?Set S3_BUCKET env var}"
CF_DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:?Set CF_DISTRIBUTION_ID env var}"
OUT_DIR="out"

echo "▶ Building..."
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://api.gatherrgo.com}" npm run build

echo "▶ Uploading to s3://${S3_BUCKET}..."

# ── HTML files — never cache (content is tied to JS chunk hashes) ────────────
find "${OUT_DIR}" -name "*.html" | while read -r file; do
  key="${file#${OUT_DIR}/}"
  aws s3 cp "${file}" "s3://${S3_BUCKET}/${key}" \
    --content-type "text/html; charset=utf-8" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --metadata-directive REPLACE
done

# ── Hashed JS / CSS / font assets — cache forever ────────────────────────────
aws s3 sync "${OUT_DIR}/_next/static" "s3://${S3_BUCKET}/_next/static" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# ── favicon.ico ──────────────────────────────────────────────────────────────
if [ -f "${OUT_DIR}/favicon.ico" ]; then
  aws s3 cp "${OUT_DIR}/favicon.ico" "s3://${S3_BUCKET}/favicon.ico" \
    --content-type "image/x-icon" \
    --cache-control "public, max-age=86400" \
    --metadata-directive REPLACE
fi

# ── Everything else ───────────────────────────────────────────────────────────
aws s3 sync "${OUT_DIR}" "s3://${S3_BUCKET}" \
  --exclude "*.html" \
  --exclude "_next/static/*" \
  --exclude "favicon.ico" \
  --cache-control "public, max-age=86400" \
  --delete

# ── Invalidate CloudFront cache ───────────────────────────────────────────────
echo "▶ Invalidating CloudFront distribution ${CF_DISTRIBUTION_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_DISTRIBUTION_ID}" \
  --paths "/*.html" "/dashboard/*.html"

echo "✓ Deploy complete."
