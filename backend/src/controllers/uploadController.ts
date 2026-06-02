// Upload controller — processes images in memory → R2
import { Request, Response } from "express";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { uploadToR2 } from "../services/r2Service";

type UploadedFile = Express.Multer.File;

const ARTICLE_IMAGE_WIDTH = 896;
const ARTICLE_IMAGE_HEIGHT = 504;
const WEBP_QUALITY = 80;

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
