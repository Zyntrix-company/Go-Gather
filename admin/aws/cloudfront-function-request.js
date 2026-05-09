/**
 * CloudFront Function — Viewer Request
 * Runtime: cloudfront-js-2.0
 *
 * Deploy in CloudFront console:
 *   Functions → Create function → paste this code → Publish
 *   Attach to distribution: Behaviors → Edit → Viewer Request → this function
 *
 * What it does:
 *   Rewrites clean URLs to their .html counterparts so Next.js static export
 *   pages are served correctly from S3 without needing S3 website hosting.
 *
 *   /                        → /index.html
 *   /login                   → /login.html
 *   /dashboard/overview      → /dashboard/overview.html
 *   /_next/static/...        → unchanged (has extension)
 *   /favicon.ico             → unchanged (has extension)
 */
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (!uri.includes('.')) {
    if (uri === '/' || uri === '') {
      request.uri = '/index.html';
    } else {
      request.uri = uri.replace(/\/$/, '') + '.html';
    }
  }

  return request;
}
