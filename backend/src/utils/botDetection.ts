/**
 * Bot / social crawler detection from User-Agent.
 *
 * Used by the OG middleware to decide whether a request needs server-rendered
 * <meta> / <link> / JSON-LD tags injected into index.html. Real users hit the
 * SPA cleanly; bots get fully populated `<head>` so social previews, search
 * engines, and AI crawlers can read the page without executing JavaScript.
 *
 * The lists below are intentionally broad — false positives are cheap (the
 * user just gets a slightly enriched HTML payload), false negatives are
 * expensive (broken Twitter/LinkedIn/Slack share cards).
 */

/**
 * Known social media crawler signatures. Matched case-insensitively against
 * the User-Agent string. Add new entries as platforms ship new bots.
 */
const SOCIAL_CRAWLERS = [
  // Facebook / Meta
  "facebookexternalhit",
  "facebookcatalog",
  "meta-externalagent",
  // Twitter / X
  "twitterbot",
  // LinkedIn
  "linkedinbot",
  // Slack, Discord, Skype, Teams, Telegram, WhatsApp, Signal, iMessage
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "skypeuripreview",
  "msteams",
  "telegrambot",
  "whatsapp",
  "signalpreview",
  "applebot", // also covers iMessage previews
  // Pinterest, Reddit, Mastodon, Tumblr, Quora, Threads, Bluesky
  "pinterest",
  "redditbot",
  "mastodon",
  "tumblr",
  "quora",
  "bluesky",
  // Email previewers
  "outlook",
  "yandeximages",
  "embedly",
  "iframely",
  "vkshare",
  "linkpreview",
  "snapchat",
] as const;

/**
 * Search engine and AI crawler signatures. Treated the same as social crawlers
 * — they all benefit from server-rendered meta + structured data.
 */
const SEARCH_AND_AI_CRAWLERS = [
  // Search engines
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "yandexbot",
  "yandeximages",
  "duckduckbot",
  "baiduspider",
  "sogou",
  "exabot",
  "seznambot",
  "naverbot",
  // News
  "googlenewsbot",
  "bingnewsbot",
  // AI / LLM crawlers
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "ccbot",
  "claude-web",
  "claudebot",
  "anthropic-ai",
  "perplexitybot",
  "you.com",
  "youbot",
  "amazonbot",
  "applebot-extended",
  "bytespider",
  "diffbot",
  "cohere-ai",
  "mistralai-user",
  // SEO / monitoring tools
  "ahrefsbot",
  "semrushbot",
  "screaming frog",
  "mj12bot",
  "dotbot",
  "rogerbot",
  "sitebulb",
] as const;

const ALL_BOT_PATTERNS = [...SOCIAL_CRAWLERS, ...SEARCH_AND_AI_CRAWLERS];

/**
 * Returns `true` when the User-Agent matches a known crawler. Empty / missing
 * UA is treated as a bot too — only real browsers send User-Agent strings.
 */
export function isBot(userAgent: string | undefined | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  const ua = userAgent.toLowerCase();
  return ALL_BOT_PATTERNS.some((sig) => ua.includes(sig));
}

/**
 * Specifically check whether the User-Agent is a *social* crawler. Useful if
 * we ever want to skip JSON-LD for social-only previews (they don't read it)
 * to keep payloads small. Not used yet but kept for future tuning.
 */
export function isSocialCrawler(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return SOCIAL_CRAWLERS.some((sig) => ua.includes(sig));
}
