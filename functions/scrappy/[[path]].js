/**
 * Same-origin reverse proxy: scrappylabs.ai/scrappy/*  ->  Scrappy rep app.
 *
 * Folds the rep INTO the main site so visitors never leave scrappylabs.ai.
 * The rep UI uses relative asset paths, so hosting it under /scrappy/ works
 * as long as we strip the /scrappy prefix before hitting the backend origin.
 *
 * Backend origin = the existing try.scrappylabs.ai tunnel (Moya :8798, with
 * /v1/realtime path-split to the Mother :8770 voice backend). Voice itself
 * rides a separate same-origin socket handled by functions/v1/realtime.js.
 */
const BACKEND = "https://try.scrappylabs.ai";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Bare /scrappy MUST become /scrappy/ or the rep's relative assets (main.js,
  // style.css) resolve against the site root and 404. Handle it here because
  // this catch-all shadows a sibling functions/scrappy.js on some routings.
  if (url.pathname === "/scrappy") {
    return Response.redirect(new URL("/scrappy/", url).toString(), 308);
  }

  // /scrappy/ -> /   ·   /scrappy/main.js -> /main.js   ·   /scrappy/api/x -> /api/x
  const backendPath = url.pathname.replace(/^\/scrappy/, "") || "/";
  const target = BACKEND + backendPath + url.search;

  const init = {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };

  const upstream = await fetch(target, init);

  // Copy the response but guarantee the mic/camera are allowed on this route
  // (the site-wide _headers policy locks them off for the marketing pages).
  const headers = new Headers(upstream.headers);
  headers.set("Permissions-Policy", "camera=(self), microphone=(self)");
  headers.delete("X-Frame-Options");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
