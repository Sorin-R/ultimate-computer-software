import { Router } from "express";
import {
  updateComment,
  deleteComment,
  toggleLike,
  reportComment,
} from "../controllers/commentController";
import { getCommentReactions, reactToComment } from "../controllers/commentReactionController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { reportRateLimiter } from "../middleware/rateLimiters";

// Routes mounted under /api/comments — operate on a comment by id, regardless
// of which article it belongs to. Listing/creating comments lives under
// /api/articles/:slug/comments (see routes/articles.ts).
const router = Router();

router.put("/:id", authenticate, updateComment);
router.delete("/:id", authenticate, deleteComment);
router.post("/:id/like", authenticate, toggleLike);
router.post("/:id/report", authenticate, reportRateLimiter, reportComment);

// K7: Emoji reactions on comments.
router.get("/:id/reactions", optionalAuthenticate, getCommentReactions);
router.post("/:id/react", authenticate, reactToComment);

export default router;
