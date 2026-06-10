import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { uploadMiddleware, uploadMiddlewareAdmin } from "../middleware/upload";
import { uploadArticleImage, uploadArticleImageFromUrl } from "../controllers/uploadController";

const router = Router();

// Middleware to select appropriate upload middleware based on admin status
const selectUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as { userId: string; role: string } | undefined;
  const isAdmin = user?.role === "ADMIN";

  if (isAdmin) {
    uploadMiddlewareAdmin.single("image")(req, res, next);
  } else {
    uploadMiddleware.single("image")(req, res, next);
  }
};

// POST /api/upload - Upload article image
router.post("/article-image", authenticate, selectUploadMiddleware, uploadArticleImage);

// POST /api/upload/from-url - Upload article image from external URL
// Fetches the image server-side, processes, and stores on R2.
// Enables full programmatic automation (AI tools, n8n, API clients).
router.post("/from-url", authenticate, uploadArticleImageFromUrl);

export default router;
