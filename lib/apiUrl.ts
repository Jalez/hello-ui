/**
 * Base path when the app is served under a prefix (e.g. /css-artist).
 * Empty string when no prefix.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Use for client-side fetch to API routes so requests go under the app prefix.
 * e.g. apiUrl("/api/games") => "/css-artist/api/games" in prod, "/api/games" locally.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return basePath ? `${basePath}${p}` : p;
}
