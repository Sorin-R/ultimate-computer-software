/**
 * Convert relative image paths to URLs the browser can load.
 *
 * - Absolute URLs (http://, https://) are returned unchanged.
 * - Relative paths (e.g. "/uploads/image.jpg") are returned as **same-origin**
 *   relative URLs. In dev that means the Vite proxy forwards them to the
 *   backend; in production they hit the same host the frontend is served from.
 *
 *   Why same-origin: hardcoding "http://localhost:4000" breaks the moment the
 *   site is opened from anything other than the Mac that runs the backend
 *   (e.g. your phone, where "localhost" means the phone itself).
 *
 * - If the deployment serves the API on a different host, set
 *   VITE_API_BASE_URL at build time and we'll prefix it.
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;

  // Already absolute — leave it alone.
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Normalize to leading slash so it joins correctly.
  const cleanPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  // Optional override via build env. Empty/undefined → same-origin (relative).
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${base}${cleanPath}`;
}
