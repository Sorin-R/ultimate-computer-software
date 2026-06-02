// Upload middleware — memory storage (files go to R2, not disk)
import multer from "multer";

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG are allowed.",
      ),
    );
  }
};

// Standard upload — 3 MB, memory storage
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 },
});

// Admin upload — 10 MB, memory storage
export const uploadMiddlewareAdmin = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
