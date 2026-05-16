import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { uploadMiddleware, uploadMiddlewareAdmin } from "../middleware/upload";
import { uploadArticleImage } from "../controllers/uploadController";

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

export default router;
