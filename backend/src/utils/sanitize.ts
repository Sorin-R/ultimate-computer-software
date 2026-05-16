import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

const ALLOWED_TAGS = [
  "article",
  "section",
  "header",
  "footer",
  "div",
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "b",
  "i",
  "u",
  "s",
  "small",
  "big",
  "tt",
  "sub",
  "sup",
  "mark",
  "ins",
  "del",
  "strong",
  "em",
  "dfn",
  "abbr",
  "code",
  "kbd",
  "samp",
  "var",
  "blockquote",
  "q",
  "cite",
  "address",
  "pre",
  "bdo",
  "bdi",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "a",
  "br",
  "hr",
  "img",
  "iframe",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "title",
  "src",
  "alt",
  "width",
  "height",
  "loading",
  "dir",
  "cite",
  "datetime",
  "lang",
  "colspan",
  "rowspan",
  "allow",
  "allowfullscreen",
  "frameborder",
  "referrerpolicy",
];

function parseTimeToSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function toYouTubeEmbedUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    let videoId: string | null = null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = path.replace(/^\/+/, "").split("/")[0] || null;
    } else if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "www.youtube-nocookie.com"
    ) {
      if (path.startsWith("/embed/")) {
        videoId = path.replace("/embed/", "").split("/")[0] || null;
      } else if (path.startsWith("/shorts/")) {
        videoId = path.replace("/shorts/", "").split("/")[0] || null;
      } else if (path.startsWith("/watch")) {
        videoId = parsed.searchParams.get("v");
      }
    }

    if (!videoId) return null;

    const startRaw = parsed.searchParams.get("start") || parsed.searchParams.get("t");
    const startSeconds = parseTimeToSeconds(startRaw);
    const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
    if (startSeconds) embed.searchParams.set("start", String(startSeconds));
    return embed.toString();
  } catch {
    return null;
  }
}

// ─── Embed URL normalizers ────────────────────────────────────────────────

/** Convert a CodeSandbox share URL to its embed form. */
function toCodeSandboxEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!url.hostname.endsWith("codesandbox.io")) return null;
    // Already an embed URL
    if (url.pathname.startsWith("/embed/")) return raw;
    // /s/<id> → /embed/<id>
    if (url.pathname.startsWith("/s/")) {
      url.pathname = url.pathname.replace("/s/", "/embed/");
      url.searchParams.set("fontsize", "14");
      url.searchParams.set("hidenavigation", "1");
      url.searchParams.set("theme", "dark");
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Convert a GitHub Gist URL to its embeddable form (uses a /meta redirect). */
function toGistEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.hostname !== "gist.github.com") return null;
    // gist.github.com/<user>/<id> → already fine for iframe embed
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    if (parts.length < 2) return null;
    const gistId = parts[1];
    return `https://gist.github.com/${parts[0]}/${gistId}`;
  } catch {
    return null;
  }
}

/** Whitelist of iframe hosts that are allowed through without transformation. */
const ALLOWED_IFRAME_HOSTS: RegExp[] = [
  /^(www\.)?youtube\.com$/,
  /^youtu\.be$/,
  /^(www\.)?youtube-nocookie\.com$/,
  /^codesandbox\.io$/,
  /^stackblitz\.com$/,
  /^codepen\.io$/,
  /^jsfiddle\.net$/,
  /^replit\.com$/,
  // Mastodon instances — any host that ends with a known pattern
  /mastodon\./,
];

function isAllowedIframeHost(src: string): boolean {
  try {
    const { hostname } = new URL(src);
    return ALLOWED_IFRAME_HOSTS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

function setIframeDefaults(iframe: Element, src: string, title: string) {
  iframe.setAttribute("src", src);
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("title", title);
}

function normalizeEmbeds(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;

  // ── Process existing iframes ──────────────────────────────────────────
  document.querySelectorAll("iframe").forEach((iframe) => {
    const src = iframe.getAttribute("src") || "";

    // 1. YouTube
    const ytUrl = toYouTubeEmbedUrl(src);
    if (ytUrl) {
      setIframeDefaults(iframe, ytUrl, "YouTube video player");
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      return;
    }

    // 2. CodeSandbox
    const csUrl = toCodeSandboxEmbedUrl(src);
    if (csUrl) {
      setIframeDefaults(iframe, csUrl, "CodeSandbox");
      iframe.setAttribute("allow", "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking");
      iframe.setAttribute("sandbox", "allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts");
      return;
    }

    // 3. General allowed hosts (StackBlitz, CodePen, Mastodon, etc.)
    if (isAllowedIframeHost(src)) {
      setIframeDefaults(iframe, src, "Embedded content");
      return;
    }

    // Unknown host — remove for safety
    iframe.remove();
  });

  // ── Auto-upgrade bare links to embeds ────────────────────────────────
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    const anchorText = (anchor.textContent || "").trim();
    const isBareLink =
      anchorText.length === 0 ||
      anchorText === href ||
      anchorText.replace(/^https?:\/\//, "") === href.replace(/^https?:\/\//, "");

    if (!isBareLink) return;

    // YouTube
    const ytUrl = toYouTubeEmbedUrl(href);
    if (ytUrl) {
      const iframe = document.createElement("iframe");
      setIframeDefaults(iframe, ytUrl, "YouTube video player");
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      anchor.replaceWith(iframe);
      return;
    }

    // CodeSandbox
    const csUrl = toCodeSandboxEmbedUrl(href);
    if (csUrl) {
      const iframe = document.createElement("iframe");
      setIframeDefaults(iframe, csUrl, "CodeSandbox");
      iframe.setAttribute("allow", "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking");
      iframe.setAttribute("sandbox", "allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts");
      anchor.replaceWith(iframe);
      return;
    }

    // GitHub Gist — render as a styled link card (iframes don't support x-frame-options here)
    const gistUrl = toGistEmbedUrl(href);
    if (gistUrl) {
      const link = document.createElement("a");
      link.setAttribute("href", gistUrl);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.textContent = `📄 GitHub Gist: ${gistUrl}`;
      anchor.replaceWith(link);
      return;
    }
  });

  return document.body.innerHTML;
}

export function sanitizeHtml(dirty: string): string {
  // Replace non-breaking spaces (both entity form and unicode char) with normal
  // spaces so that text wraps correctly at word boundaries. Rich text editors
  // (Word, Google Docs, etc.) often paste content with U+00A0 between every
  // word, which prevents line breaks.
  const normalized = dirty
    .replace(/&nbsp;/gi, " ")
    .replace(/ /g, " ");

  const sanitized = purify.sanitize(normalized, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

  return normalizeEmbeds(sanitized);
}

export function stripHtml(html: string): string {
  return purify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/** H6: Trim to the nearest full word boundary so excerpts never cut mid-word.
 *  Allows up to maxLength chars; truncates at the last space within the
 *  first 155 chars and appends "…" only when the text was actually truncated. */
export function generateExcerpt(html: string, maxLength = 160): string {
  // Extract the first <p> paragraph text. If none, fall back to stripped HTML.
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const sourceHtml = paragraphMatch ? paragraphMatch[1] : html;

  // Insert spaces between adjacent block-level tags so text doesn't concatenate
  // (e.g. "</h2><p>" -> "</h2> <p>") then strip the HTML.
  const spacedHtml = sourceHtml.replace(/>\s*</g, "> <");
  const text = stripHtml(spacedHtml).replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;

  // Truncate at the last word boundary within the first 155 characters.
  const boundary = text.lastIndexOf(" ", 155);
  const cutAt = boundary > 80 ? boundary : 155;
  return text.slice(0, cutAt).trimEnd() + "…";
}
