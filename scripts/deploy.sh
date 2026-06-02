#!/usr/bin/env bash
#
# Build and deploy the static frontend to S3 (+ optional CloudFront invalidation).
#
# Usage:
#   BUCKET=your-bucket-name \
#   [DISTRIBUTION_ID=ABCD1234] \
#   [VITE_API_BASE_URL=https://your-backend] \
#   npm run deploy
#
set -euo pipefail

: "${BUCKET:?Set BUCKET to your S3 bucket name (e.g. BUCKET=pathfinder-demo npm run deploy)}"

echo "==> Building (VITE_API_BASE_URL=${VITE_API_BASE_URL:-<unset: uses mock>})"
npm run build

echo "==> Syncing dist/ -> s3://$BUCKET"
# Long-cache the hashed assets...
aws s3 sync dist/ "s3://$BUCKET" --delete --cache-control "public,max-age=31536000,immutable" \
  --exclude index.html
# ...but never cache index.html, so new deploys take effect immediately.
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache"

if [ -n "${DISTRIBUTION_ID:-}" ]; then
  echo "==> Invalidating CloudFront distribution $DISTRIBUTION_ID"
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null
fi

echo "==> Done."
