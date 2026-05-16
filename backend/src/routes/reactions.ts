import { Router } from "express";
import { getReactions, upsertReaction } from "../controllers/reactionController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

// GET /api/articles/:slug/reactions — public, but returns myReaction if authed.
router.get("/", optionalAuthenticate, getReactions);
// POST /api/articles/:slug/reactions — requires login.
router.post("/", authenticate, upsertReaction);

export default router;
