// Lightweight proxy wrapper for Next.js standalone server.
// Apache strips the /hello-ui prefix before forwarding requests.
// This wrapper re-adds it so Next.js (with basePath: "/hello-ui") can handle them.
// Redirect Location headers are passed through unchanged so the browser stays under the app path.
//
// Without BASE_PATH set, this simply starts Next.js normally.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (!BASE_PATH) {
  // No proxy needed — start Next.js directly
  console.log("> Starting Next.js (no base path)");
  require("./server.js");
} else {
  const http = require("http");
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const NEXT_PORT = PORT + 1;
  console.log(`> Proxy mode: basePath=${BASE_PATH}, next on ${NEXT_PORT}, proxy on ${PORT}`);

  // Start Next.js on an internal port
  process.env.PORT = String(NEXT_PORT);
  process.env.HOSTNAME = "127.0.0.1";
  try {
    require("./server.js");
  } catch (err) {
    console.error("> Failed to start Next.js:", err);
    process.exit(1);
  }

  // Proxy that re-adds basePath to incoming requests (listen immediately so Apache always has a backend)
  const proxy = http.createServer((req, res) => {
    const url = req.url || "/";
    const [pathPart, ...queryParts] = url.split("?");
    const queryString = queryParts.length ? "?" + queryParts.join("?") : "";

    // Did we need to add the prefix, or was it already there?
    const alreadyPrefixed = pathPart.startsWith(BASE_PATH);
    let path = alreadyPrefixed ? pathPart : BASE_PATH + (pathPart === "" ? "/" : pathPart);

    // Next.js default is trailingSlash: false, so it 308-redirects /base/ -> /base.
    // When path is app root (with or without trailing slash), use /base (no slash)
    // so Next.js serves the page instead of redirecting (which would loop).
    if (path === BASE_PATH + "/" || path === BASE_PATH || path === BASE_PATH + "") {
      path = BASE_PATH;
    }

    const prefixedUrl = path + queryString;

    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: NEXT_PORT,
        path: prefixedUrl,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        const headers = { ...proxyRes.headers };

        // Leave Location (and Refresh) as-is so the browser stays under /hello-ui.
        // Next.js sends e.g. Location: /hello-ui or /hello-ui/account; we must
        // not strip the prefix or the browser would go to the site root.

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on("error", (err) => {
      console.error("Proxy error:", err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end("Bad Gateway");
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  proxy.listen(PORT, "0.0.0.0", () => {
    console.log(
      `> Proxy listening on port ${PORT}, forwarding to Next.js on port ${NEXT_PORT} with basePath ${BASE_PATH}`
    );
  });
}
