import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function asBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  SITE_URL: process.env.SITE_URL || "https://www.ultimatecomputersoftware.com",
  TWO_FACTOR_ENCRYPTION_KEY: process.env.TWO_FACTOR_ENCRYPTION_KEY || "",
  TWO_FACTOR_ISSUER: process.env.TWO_FACTOR_ISSUER || "Ultimate Computer Software",
  // Email Configuration
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "noreplay@ultimatecomputersoftware.com",
  SMTP_FROM_PRIVACY:
    process.env.SMTP_FROM_PRIVACY ||
    process.env.SMTP_FROM_EMAIL ||
    "privacy@ultimatecomputersoftware.com",
  SMTP_FROM_COPYRIGHT:
    process.env.SMTP_FROM_COPYRIGHT ||
    process.env.SMTP_FROM_EMAIL ||
    "copyright@ultimatecomputersoftware.com",
  SMTP_FROM_SUPPORT:
    process.env.SMTP_FROM_SUPPORT ||
    process.env.SMTP_FROM_EMAIL ||
    "support@ultimatecomputersoftware.com",
  SMTP_FROM_NOREPLY:
    process.env.SMTP_FROM_NOREPLY ||
    process.env.SMTP_FROM_NOREPLAY ||
    process.env.SMTP_FROM_EMAIL ||
    "noreplay@ultimatecomputersoftware.com",
  TRUST_PROXY: process.env.TRUST_PROXY || "0",
  COOKIE_SAME_SITE:
    (process.env.COOKIE_SAME_SITE || "lax").toLowerCase() as
      | "lax"
      | "strict"
      | "none",
  COOKIE_SECURE: asBool(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production"),
  CAPTCHA_REQUIRED: asBool(
    process.env.CAPTCHA_REQUIRED,
    process.env.NODE_ENV === "production"
  ),
  CAPTCHA_VERIFY_URL:
    process.env.CAPTCHA_VERIFY_URL ||
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  CAPTCHA_SECRET: process.env.CAPTCHA_SECRET || "",
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || "25mb",
  ARTICLE_AUDIO_ENABLED: asBool(process.env.ARTICLE_AUDIO_ENABLED, true),
  ARTICLE_AUDIO_PROVIDER: process.env.ARTICLE_AUDIO_PROVIDER || "openrouter-kokoro",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_TTS_MODEL: process.env.OPENROUTER_TTS_MODEL || "hexgrad/kokoro-82m",
  OPENROUTER_TTS_VOICE: process.env.OPENROUTER_TTS_VOICE || "af_heart",
  OPENROUTER_TTS_RESPONSE_FORMAT: process.env.OPENROUTER_TTS_RESPONSE_FORMAT || "mp3",
  OPENROUTER_TTS_TIMEOUT_MS: parseInt(process.env.OPENROUTER_TTS_TIMEOUT_MS || "120000", 10),
  OPENROUTER_TTS_CHUNK_CHARS: parseInt(process.env.OPENROUTER_TTS_CHUNK_CHARS || "3500", 10),
};

if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
  console.error("FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in .env");
  process.exit(1);
}

if (env.NODE_ENV === "production" && !env.TWO_FACTOR_ENCRYPTION_KEY) {
  console.error("FATAL: TWO_FACTOR_ENCRYPTION_KEY must be set in production.");
  process.exit(1);
}

if (!["lax", "strict", "none"].includes(env.COOKIE_SAME_SITE)) {
  console.error("FATAL: COOKIE_SAME_SITE must be one of: lax, strict, none.");
  process.exit(1);
}

if (env.NODE_ENV === "production" && env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
  console.error("FATAL: COOKIE_SECURE must be true when COOKIE_SAME_SITE=none in production.");
  process.exit(1);
}

if (env.CAPTCHA_REQUIRED && !env.CAPTCHA_SECRET) {
  console.error("FATAL: CAPTCHA_SECRET must be set when CAPTCHA_REQUIRED=true.");
  process.exit(1);
}

// Warn if email configuration is incomplete (but don't exit - email is optional)
if (!env.SMTP_PASS) {
  console.warn("WARNING: SMTP_PASS is not configured. Email notifications will not work.");
  console.warn("Configure SMTP settings in .env to enable email features.");
}
