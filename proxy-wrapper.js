// Lightweight proxy wrapper for Next.js standalone server.
// Apache strips the /css-artist prefix before forwarding requests.
// This wrapper re-adds it so Next.js (with basePath: "/css-artist") can handle them.
//
// It also rewrites Location headers in redirects — Next.js includes the basePath
// in redirect URLs, but since Apache already adds it back, we must strip it to
// prevent double-prefixing and redirect loops.
//
// Without BASE_PATH set, this simply starts Next.js normally.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (!BASE_PATH) {
  // No proxy needed — start Next.js directly
  require("./server.js");
} else {
  const http = require("http");
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const NEXT_PORT = PORT + 1;

  // Start Next.js on an internal port
  process.env.PORT = String(NEXT_PORT);
  process.env.HOSTNAME = "127.0.0.1";
  require("./server.js");

  // Proxy that re-adds basePath to incoming requests
  const proxy = http.createServer((req, res) => {
    const url = req.url || "/";
    const prefixedUrl = url.startsWith(BASE_PATH) ? url : BASE_PATH + url;

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

        // Strip basePath from Location headers to prevent redirect loops.
        // Next.js sends "Location: /css-artist/foo" but the browser already
        // requests via /css-artist (through Apache), so we need "Location: /foo".
        // Apache will then route /css-artist/foo back to us as /foo.
        if (headers.location && headers.location.startsWith(BASE_PATH)) {
          headers.location = headers.location.slice(BASE_PATH.length) || "/";
        }

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
