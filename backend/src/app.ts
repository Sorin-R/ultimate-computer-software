import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import path from "path";
import fs from "fs";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { attachCsrfCookie, requireCsrfProtection } from "./middleware/csrf";
import { publishScheduledArticles } from "./controllers/articleController";
import authRoutes from "./routes/auth";
import articleRoutes from "./routes/articles";
import storyRoutes from "./routes/stories";
import categoryRoutes from "./routes/categories";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";
import configRoutes from "./routes/config";
import contactRoutes from "./routes/contact";
import commentRoutes from "./routes/comments";
import homeRoutes from "./routes/home";
import subscriptionRoutes from "./routes/subscriptions";
import bookmarkRoutes from "./routes/bookmarks";
import seriesRoutes from "./routes/series";
import tagRoutes from "./routes/tags";
import requestRoutes from "./routes/requests";
import readingListRoutes from "./routes/readingLists";
import pollRoutes from "./routes/polls";
import meRoutes from "./routes/me";
import reportRoutes from "./routes/reports";
import statsRoutes from "./routes/stats";
import {
  getAuthorRss,
  getCategoryRss,
  getRobotsTxt,
  getSitemapXml,
  getTagRss,
} from "./controllers/seoController";
import { getAuthorEmbedCard } from "./controllers/embedController";
import { getArticleOgImage } from "./controllers/ogController";
import { ogBotMiddleware } from "./middleware/ogBotMiddleware";

const app = express();
const trustProxyValue = /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY;
app.set("trust proxy", trustProxyValue);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "http://localhost:4000", "http://localhost:5173"],
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", env.FRONTEND_URL, "https://challenges.cloudflare.com"],
        frameSrc: [
          "'self'",
          "https://challenges.cloudflare.com",
          "https://www.youtube.com",
          "https://youtu.be",
          "https://www.youtube-nocookie.com",
          "https://codesandbox.io",
          "https://stackblitz.com",
          "https://codepen.io",
          "https://jsfiddle.net",
          "https://replit.com",
        ],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// C1: Gzip/Brotli compression for response bodies (JSON, HTML, CSS, JS).
// Compresses responses > 1 KB and skips already-compressed assets.
app.use(compression({ filter: (req, res) => {
  if (req.headers["x-no-compression"]) {
    return false;
  }
  return compression.filter(req, res);
} }));

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// C2: Scheduled publishing — check every minute
cron.schedule("* * * * *", () => {
  publishScheduledArticles().catch((err) =>
    console.error("[cron] publishScheduledArticles error:", err)
  );
});

// Serve static files from uploads directory with long-lived cache headers.
// H4: immutable + 30-day maxAge so browsers and CDNs cache uploaded images
// aggressively. New files always get new URLs (content-addressable filenames),
// so stale cache is never a risk for changed files.
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "30d",
    immutable: true,
    etag: true,
  })
);

app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));
app.use(attachCsrfCookie);
app.use(requireCsrfProtection);

const isProd = process.env.NODE_ENV === "production";
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 600 : 5000,
  message: { error: "Too many requests" },
  // Skip rate limiting entirely in non-production so local dev/testing isn't blocked.
  skip: () => !isProd,
});
app.use(globalLimiter);

app.get("/sitemap.xml", getSitemapXml);
app.get("/robots.txt", getRobotsTxt);
app.get("/rss/author/:slug.xml", getAuthorRss);
app.get("/rss/category/:slug.xml", getCategoryRss);
app.get("/rss/tag/:slug.xml", getTagRss);
app.get("/embed/author/:slug", getAuthorEmbedCard);
// C6: Auto-generated OG share images. Served at root so social crawlers
// (Facebook, X/Twitter, LinkedIn) can fetch them directly via og:image meta.
// Slug param matches ".png" suffix too — the controller strips it.
app.get("/og/article/:slug", getArticleOgImage);

app.use("/api/auth", authRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/config", configRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/home", homeRoutes);
// Mounts /api/users/* (public-ish) and /api/me/* (auth) under one router.
app.use("/api", subscriptionRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/reading-lists", readingListRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/me", meRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Bot OG middleware: detects crawlers (Facebook, Twitter, LinkedIn, GPTBot,
// PerplexityBot, etc.) and serves them index.html with server-rendered meta
// tags + JSON-LD injected into <head>. Real users pass through untouched so
// the SPA still loads normally. Must come AFTER all API/SEO routes so those
// take precedence, and BEFORE errorHandler so the catch-all can still respond.
const frontendDist = path.join(process.cwd(), "..", "frontend", "dist");
app.use(express.static(frontendDist));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  ogBotMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    const indexHtml = path.join(frontendDist, "index.html");
    res.status(200).type("html").send(fs.readFileSync(indexHtml, "utf8"));
  });
});

app.use(errorHandler);

export default app;
