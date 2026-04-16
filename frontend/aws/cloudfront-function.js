/**
 * CloudFront Function — Response Handler
 * Runtime: cloudfront-js-2.0
 *
 * Deploy in CloudFront console:
 *   Functions → Create function → paste this code → Publish
 *   Then attach to your distribution:
 *     Behaviors → Edit → Function associations → Viewer Response → this function
 *
 * What it does:
 *   1. Adds X-Robots-Tag: noindex to /sitemap.xml so it never appears in Google search
 *   2. Adds security + SEO-friendly response headers to every page
 */
function handler(event) {
  var response = event.response;
  var request  = event.request;
  var headers  = response.headers;

  // ── 1. Prevent sitemap.xml from appearing in Google search results ──────────
  // Google reads X-Robots-Tag on non-HTML files; <meta robots> has no effect on XML.
  if (request.uri === '/sitemap.xml') {
    headers['x-robots-tag'] = { value: 'noindex, nofollow' };
  }

  // ── 2. Security / SEO headers on all responses ─────────────────────────────
  // Prevents clickjacking
  headers['x-frame-options'] = { value: 'SAMEORIGIN' };
  // Prevents MIME sniffing (important for SEO crawlers and security)
  headers['x-content-type-options'] = { value: 'nosniff' };
  // Forces HTTPS for 1 year (only added on HTTPS responses — CloudFront always serves HTTPS)
  headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubDomains' };
  // Controls referrer info sent to external links
  headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };

  return response;
}
