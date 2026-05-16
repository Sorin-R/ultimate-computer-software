const RAW_SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();

export const SITE_URL = (RAW_SITE_URL && RAW_SITE_URL.length > 0
  ? RAW_SITE_URL
  : "https://www.ultimatecomputersoftware.com"
).replace(/\/$/, "");

export function absoluteSiteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
