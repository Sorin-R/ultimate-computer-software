import { Router } from "express";
import { createPoll, getPoll, votePoll } from "../controllers/pollController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createPoll);
router.get("/:id", optionalAuthenticate, getPoll);
router.post("/:id/vote", authenticate, votePoll);

export default router;
