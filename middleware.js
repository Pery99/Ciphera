const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host"
]);

function resolveBackendOrigin() {
  const origin = (process.env.RAILWAY_API_ORIGIN || process.env.VITE_SOCKET_URL || "").trim();
  if (!origin || origin.startsWith("/")) {
    return null;
  }
  return origin.replace(/\/$/, "");
}

export default async function middleware(request) {
  const origin = resolveBackendOrigin();
  if (!origin) {
    return new Response(
      JSON.stringify({ message: "Backend origin not configured. Set RAILWAY_API_ORIGIN on Vercel." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const incoming = new URL(request.url);
  const target = `${origin}${incoming.pathname}${incoming.search}`;

  const headers = new Headers(request.headers);
  for (const key of HOP_BY_HOP) {
    headers.delete(key);
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual"
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const key of HOP_BY_HOP) {
    responseHeaders.delete(key);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export const config = {
  matcher: "/api/:path*"
};