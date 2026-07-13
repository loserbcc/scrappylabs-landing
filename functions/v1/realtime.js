/**
 * Same-origin WebSocket proxy for the voice backend.
 *
 * When the rep is served at scrappylabs.ai/scrappy/, its client resolves the
 * speech-to-speech endpoint to the page origin and dials wss://scrappylabs.ai
 * /v1/realtime. We forward that upgrade to the existing try.scrappylabs.ai
 * tunnel, which path-splits /v1/realtime to the Mother :8770 voice backend.
 *
 * Returning the fetch() response verbatim (including its `webSocket`) is the
 * documented Cloudflare pattern for proxying a WebSocket upgrade.
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  url.hostname = "try.scrappylabs.ai";
  url.protocol = "https:";
  url.port = "";
  return fetch(new Request(url, request));
}
