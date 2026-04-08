/**
 * Base path when the app is served under a prefix (e.g. /hello-ui).
 * Empty string when no prefix.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Use for client-side fetch to API routes so requests go under the app prefix.
 * e.g. apiUrl("/api/games") => "/hello-ui/api/games" in prod, "/api/games" locally.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return basePath ? `${basePath}${p}` : p;
}

/**
 * Normalize a pathname returned by Next navigation hooks so route checks can be
 * written against app-internal paths (`/game/...`, `/creator/...`) regardless
 * of whether a deployment basePath is present.
 */
export function stripBasePath(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || "/";
  }

  return pathname;
}
