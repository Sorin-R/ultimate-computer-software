// Upload controller — processes images in memory → R2
import { Request, Response } from "express";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { uploadToR2 } from "../services/r2Service";

type UploadedFile = Express.Multer.File;

const ARTICLE_IMAGE_WIDTH = 896;
const ARTICLE_IMAGE_HEIGHT = 504;
const WEBP_QUALITY = 80;
const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB max for remote images
const REMOTE_FETCH_TIMEOUT_MS = 15_000; // 15s timeout for external image fetch

/**
 * POST /api/upload/from-url
 * Accepts an image URL, fetches it server-side, resizes to 896×504 WebP, uploads to R2.
 * Enables full programmatic automation (AI tools, n8n workflows, API clients)
 * without needing a file upload. The image is copied onto your own storage —
 * no hotlinking or third-party dependency.
 */
export const uploadArticleImageFromUrl = async (
  req: Request,
  res: Response,
) => {
  const { imageUrl } = req.body as { imageUrl?: string };

  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).json({ error: "imageUrl is required (string)" });
  }

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return res.status(400).json({ error: "Only http and https URLs are allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid imageUrl — must be a valid URL" });
  }

  try {
    // 1. Fetch the remote image with size + timeout guards.
    //    Many image hosts (Vecteezy, Wikimedia, Unsplash, etc.) block requests
    //    without a browser-looking User-Agent, so we impersonate a real browser.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Some CDNs require a Referer; send the origin of the image URL
        Referer: parsed.origin + "/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      // Special message for 403 — many CDNs (Vecteezy, Getty, Shutterstock)
      // block all non-browser requests via WAF/CAPTCHA. Not fixable server-side.
      const hint403 =
        response.status === 403
          ? " The image server is blocking automated requests (common with Vecteezy, Shutterstock, Getty). Try a different image source like Flickr, Pexels, Unsplash, NASA, or Wikimedia Commons."
          : "";
      return res.status(422).json({
        error: `Failed to fetch image from URL. Server returned ${response.status} ${response.statusText}.${hint403}`,
      });
    }

    // Validate content type is an image
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(422).json({
        error: `URL did not return an image (content-type: ${contentType || "unknown"})`,
      });
    }

    // Stream + cap at max size
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(422).json({ error: "No response body from remote URL" });
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REMOTE_IMAGE_BYTES) {
        reader.cancel();
        return res.status(422).json({
          error: `Remote image exceeds maximum size of ${MAX_REMOTE_IMAGE_BYTES / 1024 / 1024} MB`,
        });
      }
      chunks.push(Buffer.from(value));
    }

    if (totalBytes === 0) {
      return res.status(422).json({ error: "Remote image is empty (0 bytes)" });
    }

    const buffer = Buffer.concat(chunks);

    // 2. Process: resize to 896×504, convert to WebP
    const uuid = randomUUID().slice(0, 8);
    const key = `articles/${Date.now()}-${uuid}.webp`;

    const optimized = await sharp(buffer)
      .resize(ARTICLE_IMAGE_WIDTH, ARTICLE_IMAGE_HEIGHT, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // 3. Upload to R2 — image now lives on your own storage
    const { url } = await uploadToR2(key, optimized, "image/webp");

    return res.status(200).json({
      success: true,
      imageUrl: url,
      key,
      message: "Image fetched, optimized, and stored successfully",
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return res.status(422).json({
        error: `Image fetch timed out after ${REMOTE_FETCH_TIMEOUT_MS / 1000} seconds`,
      });
    }
    console.error("Upload-from-URL error:", error);
    return res.status(500).json({
      error: "Failed to fetch or process image from URL. Please verify the URL points to a valid image.",
    });
  }
};

/**
 * POST /api/upload/article-image
 * Accepts an image (JPEG/PNG/WebP/GIF), resizes to 896×504 WebP, uploads to R2.
 */
export const uploadArticleImage = async (
  req: Request & { file?: UploadedFile },
  res: Response,
) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const buffer = req.file.buffer;
    const originalName = req.file.originalname.replace(/\.[^.]+$/, "");
    const uuid = randomUUID().slice(0, 8);
    const key = `articles/${Date.now()}-${uuid}.webp`;

    // Resize & convert to WebP in memory
    const optimized = await sharp(buffer)
      .resize(ARTICLE_IMAGE_WIDTH, ARTICLE_IMAGE_HEIGHT, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // Upload to R2
    const { url } = await uploadToR2(key, optimized, "image/webp");

    return res.status(200).json({
      success: true,
      imageUrl: url,
      key,
      message: "Image uploaded and optimized successfully",
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return res.status(500).json({
      error: "Failed to process image. Please ensure it is a valid image file.",
    });
  }
};
