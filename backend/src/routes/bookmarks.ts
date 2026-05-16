import { Router } from "express";
import { listBookmarks, toggleBookmark, checkBookmark } from "../controllers/bookmarkController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All bookmark routes require authentication.
router.get("/", authenticate, listBookmarks);
router.post("/", authenticate, toggleBookmark);
router.get("/check/:articleId", authenticate, checkBookmark);

export default router;
