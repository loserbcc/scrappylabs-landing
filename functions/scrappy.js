/**
 * Bare /scrappy -> /scrappy/ (trailing slash).
 *
 * The rep UI references its assets relatively, so the document MUST be served
 * from a path ending in "/scrappy/" or "main.js" etc. would resolve against
 * the site root and 404. Redirect the slash-less form up front.
 */
export function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/scrappy/";
  return Response.redirect(url.toString(), 308);
}
