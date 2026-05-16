import { Helmet } from "react-helmet-async";
import { SITE_URL } from "../utils/site";

// M3: Site-level Twitter/X handle. Set VITE_TWITTER_HANDLE in your .env to
// override (e.g. "@UltimateCompSW"). Handles are normalised to ensure single @.
const SITE_TWITTER_HANDLE = normaliseTwitterHandle(
  import.meta.env.VITE_TWITTER_HANDLE as string | undefined
);

function normaliseTwitterHandle(handle?: string | null): string | null {
  if (!handle) return null;
  const cleaned = handle.trim().replace(/^@+/, "");
  return cleaned ? `@${cleaned}` : null;
}

interface SEOHeadProps {
  title: string;
  description?: string;
  path?: string;
  type?: string;
  appendSiteName?: boolean;
  /**
   * C6: Absolute URL to a 1200×630 share card. When omitted, falls back
   * to a static brand image at /og-default.png.
   */
  imageUrl?: string;
  /**
   * Human-readable alt text for social share images.
   */
  imageAlt?: string;
  /**
   * Set to true to add noindex,nofollow to prevent search engine indexing.
   */
  noindex?: boolean;
  /**
   * Author name for the author meta tag (used on article pages).
   */
  author?: string;
  /**
   * M3: Optional Twitter/X handle of the article author (e.g. "@JaneDoe").
   * Normalised automatically — you can pass with or without leading @.
   */
  twitterAuthor?: string | null;
  /**
   * Article publication and update timestamps as ISO strings.
   */
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /**
   * Article section/category and tags for Open Graph article metadata.
   */
  section?: string | null;
  tags?: string[];
  /**
   * M6: When true, the canonical URL is forced to `path` even if the browser
   * is currently on a paginated variant (e.g. /category/ai?page=2).
   * Defaults to true — pass false only for pages that genuinely own their query string.
   */
  cleanCanonical?: boolean;
}

export default function SEOHead({
  title,
  description,
  path = "",
  type = "website",
  appendSiteName = true,
  imageUrl,
  imageAlt,
  noindex = false,
  author,
  twitterAuthor,
  publishedTime,
  modifiedTime,
  section,
  tags = [],
  cleanCanonical = true,
}: SEOHeadProps) {
  const fullTitle = appendSiteName ? `${title} | Ultimate Computer Software` : title;
  // M6: Strip query params from the canonical URL so paginated variants
  // (e.g. /category/ai?page=2) all point back to the clean base URL.
  const canonicalPath = cleanCanonical ? path.split("?")[0] : path;
  const url = `${SITE_URL}${canonicalPath}`;
  const desc = description || "Your trusted source for worldwide technology news.";
  const ogImage = imageUrl || `${SITE_URL}/og-default.png`;
  const socialImageAlt = imageAlt || desc;
  const twitterCreator = normaliseTwitterHandle(twitterAuthor);
  const isArticle = type === "article";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta name="description" content={desc} />
      {author && <meta name="author" content={author} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={socialImageAlt} />
      <meta property="og:site_name" content="Ultimate Computer Software" />
      <meta property="og:locale" content="en_US" />
      {isArticle && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {isArticle && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {isArticle && modifiedTime && <meta property="og:updated_time" content={modifiedTime} />}
      {isArticle && author && <meta property="article:author" content={author} />}
      {isArticle && section && <meta property="article:section" content={section} />}
      {isArticle &&
        tags.map((tag) => <meta key={`article-tag-${tag}`} property="article:tag" content={tag} />)}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={socialImageAlt} />
      {/* M3: Site handle — set VITE_TWITTER_HANDLE env var to enable */}
      {SITE_TWITTER_HANDLE && <meta name="twitter:site" content={SITE_TWITTER_HANDLE} />}
      {/* M3: Author handle — populated by article pages via twitterAuthor prop */}
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}
    </Helmet>
  );
}
