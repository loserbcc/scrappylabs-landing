/**
 * Same-origin reverse proxy: scrappylabs.ai/scrappy/*  ->  Scrappy rep app.
 *
 * Folds the rep INTO the main site so visitors never leave scrappylabs.ai.
 * Backend origin = the existing try.scrappylabs.ai tunnel (Moya :8798, with
 * /v1/realtime path-split to the Mother :8770 voice backend). The voice socket
 * itself is same-origin and handled by functions/v1/realtime.js.
 *
 * The rep UI references assets relatively. We inject <base href="/scrappy/">
 * into the proxied HTML so those assets resolve correctly whether or not the
 * visitor included the trailing slash (CF normalizes /scrappy before a Function
 * can redirect it, so a <base> is more reliable than a redirect here).
 */
const BACKEND = "https://try.scrappylabs.ai";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // /scrappy or /scrappy/ -> /   ·   /scrappy/main.js -> /main.js
  const backendPath = url.pathname.replace(/^\/scrappy\/?/, "/");
  const target = BACKEND + backendPath + url.search;

  const init = {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };

  const upstream = await fetch(target, init);

  // Guarantee mic/camera on this route (the site-wide _headers policy locks
  // them off for the marketing pages).
  const headers = new Headers(upstream.headers);
  headers.set("Permissions-Policy", "camera=(self), microphone=(self)");
  headers.delete("X-Frame-Options");

  let response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  if ((headers.get("content-type") || "").includes("text/html")) {
    response = new HTMLRewriter()
      .on("head", {
        element(el) {
          el.prepend('<base href="/scrappy/">', { html: true });
        },
      })
      .transform(response);
  }

  return response;
}
