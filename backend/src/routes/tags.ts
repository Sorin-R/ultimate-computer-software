import { Router } from "express";
import { listTags, getTag, getMyFollowedTags, toggleTagFollow, getTagFeed } from "../controllers/tagController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

router.get("/", optionalAuthenticate, listTags);
router.get("/me", authenticate, getMyFollowedTags);
router.get("/feed", authenticate, getTagFeed);
router.get("/:slug", optionalAuthenticate, getTag);
router.post("/:slug/follow", authenticate, toggleTagFollow);

export default router;
