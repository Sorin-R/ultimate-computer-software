import { Router } from "express";
import {
  getMainArticle,
  getFeed,
  getFromYourFollows,
} from "../controllers/homeController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

// POST so anonymous clients can send their localStorage reading history in the
// body. Optional auth: when a logged-in user calls it, req.user is populated
// and the body is ignored in favour of the database-backed history.
router.post("/main-article", optionalAuthenticate, getMainArticle);

// Sortable, paginated feed used by the "Latest News" section on the homepage
// and by the category page. Same auth/anonymous rules as /main-article.
router.post("/feed", optionalAuthenticate, getFeed);

// Latest articles from creators the current user follows (U4). Login required —
// anonymous callers always get an empty list.
router.get("/from-your-follows", authenticate, getFromYourFollows);

export default router;
