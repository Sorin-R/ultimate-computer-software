import { Router } from "express";
import {
  listArticleRequests,
  createArticleRequest,
  voteArticleRequest,
  claimArticleRequest,
  fulfillArticleRequest,
  deleteArticleRequest,
} from "../controllers/articleRequestController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

router.get("/", optionalAuthenticate, listArticleRequests);
router.post("/", authenticate, createArticleRequest);
router.post("/:id/vote", authenticate, voteArticleRequest);
router.post("/:id/claim", authenticate, claimArticleRequest);
router.post("/:id/fulfill", authenticate, fulfillArticleRequest);
router.delete("/:id", authenticate, deleteArticleRequest);

export default router;
