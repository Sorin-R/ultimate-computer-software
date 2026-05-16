import { Router } from "express";
import {
  getPublishedArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  getUserArticles,
  getUserArticleById,
  recordArticleView,
  getArticleStats,
  getMyHistory,
  listArticleVersions,
  getArticleVersion,
  getActiveAmas,
  getSearchFacets,
} from "../controllers/articleController";
import { listReviews, upsertReview } from "../controllers/reviewController";
import { listComments, createComment } from "../controllers/commentController";
import { getArticlePolls } from "../controllers/pollController";
import reactionRouter from "./reactions";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { validateCreateArticleByRole, validateUpdateArticleByRole } from "../middleware/validateArticleByRole";

const router = Router();

router.get("/", getPublishedArticles);
router.get("/mine", authenticate, getUserArticles);
router.get("/mine/:id", authenticate, getUserArticleById);
// Reading history + AMAs — must be before /:slug to avoid slug capture.
router.get("/me/history", authenticate, getMyHistory);
router.get("/amas", getActiveAmas);
router.get("/search/facets", getSearchFacets);
router.get("/:slug", optionalAuthenticate, getArticleBySlug);
router.post("/", authenticate, validateCreateArticleByRole, createArticle);
router.put("/:id", authenticate, validateUpdateArticleByRole, updateArticle);
router.delete("/:id", authenticate, deleteArticle);

// Reviews / star ratings for a published article.
router.get("/:slug/reviews", listReviews);
router.post("/:slug/reviews", authenticate, upsertReview);

// Comments on a published article.
router.get("/:slug/comments", optionalAuthenticate, listComments);
router.post("/:slug/comments", authenticate, createComment);

// Emoji reactions on a published article.
router.use("/:slug/reactions", reactionRouter);

// View tracking for published articles. optionalAuthenticate is used so that
// logged-in users have their userId attached to the view record (required for
// reading-history personalisation), while anonymous reads still work.
router.post("/:slug/views", optionalAuthenticate, recordArticleView);
router.get("/:id/stats", authenticate, getArticleStats);

// C1: Version history — owner only.
router.get("/:id/versions", authenticate, listArticleVersions);
router.get("/:id/versions/:versionId", authenticate, getArticleVersion);

// K10: Polls embedded in an article.
router.get("/:articleId/polls", optionalAuthenticate, getArticlePolls);

export default router;
