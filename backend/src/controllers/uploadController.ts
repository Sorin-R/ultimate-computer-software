import { Request, Response } from "express";
import sharp from "sharp";
import path from "path";
import fs from "fs";

export const uploadArticleImage = async (
  req: Request & { file?: Express.Multer.File },
  res: Response
) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Get the uploaded file path
    const uploadedFilePath = req.file.path;
    const filename = req.file.filename;
    const outputPath = path.join(
      path.dirname(uploadedFilePath),
      `${path.basename(filename, path.extname(filename))}-optimized.webp`
    );

    // Resize and convert to WebP for optimization (16:9 landscape aspect ratio)
    await sharp(uploadedFilePath)
      .resize(896, 504, {
        fit: "cover", // Crop to fill the rectangle
        position: "center",
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Delete original file
    fs.unlinkSync(uploadedFilePath);

    // Return the relative path to the optimized image
    const relativePath = `/uploads/${path.basename(outputPath)}`;

    return res.status(200).json({
      success: true,
      imageUrl: relativePath,
      message: "Image uploaded and optimized successfully",
    });
  } catch (error) {
    // Clean up uploaded file if optimization fails
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Image upload error:", error);
    return res.status(500).json({
      error: "Failed to process image. Please ensure it is a valid image file.",
    });
  }
};
