/**
 * CloudFront Function — Viewer Response
 * Runtime: cloudfront-js-2.0
 *
 * Deploy in CloudFront console:
 *   Functions → Create function → paste this code → Publish
 *   Attach to distribution: Behaviors → Edit → Viewer Response → this function
 *
 * What it does:
 *   Adds security headers to every response.
 *   Admin panel is internal — block all search engine indexing.
 */
function handler(event) {
  var response = event.response;
  var headers  = response.headers;

  headers['x-robots-tag']                = { value: 'noindex, nofollow' };
  headers['x-frame-options']             = { value: 'DENY' };
  headers['x-content-type-options']      = { value: 'nosniff' };
  headers['strict-transport-security']   = { value: 'max-age=31536000; includeSubDomains' };
  headers['referrer-policy']             = { value: 'strict-origin-when-cross-origin' };

  return response;
}
