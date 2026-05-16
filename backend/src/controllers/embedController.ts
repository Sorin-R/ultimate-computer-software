import { Request, Response } from "express";
import prisma from "../config/db";
import { env } from "../config/env";
import { param } from "../utils/params";

function siteUrl(): string {
  return (env.SITE_URL || "https://www.ultimatecomputersoftware.com").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function candidateName(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

export async function getAuthorEmbedCard(req: Request, res: Response): Promise<void> {
  const slug = param(req.params.slug);

  const author = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { id: slug },
        { name: { equals: candidateName(slug), mode: "insensitive" } },
      ],
      articles: { some: { status: "PUBLISHED" } },
    },
    select: { id: true, name: true, bio: true, avatarUrl: true, isVerified: true },
  });

  if (!author) {
    res.status(404).send("Author not found");
    return;
  }

  const [readsAgg, articleCount] = await Promise.all([
    prisma.articleView.aggregate({
      where: {
        article: { userId: author.id, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
    prisma.article.count({ where: { userId: author.id, status: "PUBLISHED" } }),
  ]);

  const totalReads = readsAgg._count._all;
  const safeName = escapeHtml(author.name);
  const safeBio = escapeHtml((author.bio || "Technology contributor").slice(0, 180));
  const safeAvatar = author.avatarUrl ? escapeHtml(author.avatarUrl) : null;
  const profileUrl = `${siteUrl()}/author/${encodeURIComponent(author.id)}`;
  const safeProfileUrl = escapeHtml(profileUrl);

  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'; font-src https: data:; connect-src 'none'; frame-ancestors *;");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeName} - Author Card</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: 'IBM Plex Sans', Roboto, Arial, sans-serif; background: #f8f8f6; }
    .card { max-width: 420px; margin: 0 auto; border: 1px solid #1111111a; background: #fff; padding: 16px; }
    .top { display: flex; gap: 12px; align-items: center; }
    .avatar { width: 56px; height: 56px; border-radius: 999px; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    h1 { margin: 0; font-size: 18px; line-height: 1.2; color: #111; }
    .verified { display: inline-block; margin-left: 6px; color: #0a7d34; font-size: 12px; font-weight: 600; }
    .bio { margin: 10px 0 0; color: #555; font-size: 13px; line-height: 1.45; }
    .stats { margin-top: 12px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
    .stat { border: 1px solid #11111114; padding: 8px; }
    .stat b { display: block; font-size: 16px; color: #111; }
    .stat span { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; }
    .link { display: inline-block; margin-top: 14px; padding: 8px 10px; background: #b5121b; color: #fff; text-decoration: none; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    @media (max-width: 420px) {
      .card { border-left: none; border-right: none; }
    }
  </style>
</head>
<body>
  <article class="card">
    <div class="top">
      <div class="avatar">${
        safeAvatar
          ? `<img src="${safeAvatar}" alt="${safeName}" />`
          : safeName.slice(0, 1).toUpperCase()
      }</div>
      <div>
        <h1>${safeName}${author.isVerified ? '<span class="verified">Verified</span>' : ""}</h1>
      </div>
    </div>
    <p class="bio">${safeBio}</p>
    <div class="stats">
      <div class="stat"><b>${articleCount.toLocaleString()}</b><span>Articles</span></div>
      <div class="stat"><b>${totalReads.toLocaleString()}</b><span>Total Reads</span></div>
    </div>
    <a class="link" href="${safeProfileUrl}" target="_blank" rel="noopener noreferrer">View Profile</a>
  </article>
</body>
</html>`;

  res.send(html);
}
