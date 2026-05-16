import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { reportRateLimiter } from "../middleware/rateLimiters";
import { createReport, getMyReports } from "../controllers/reportController";

const router = Router();

router.post("/", authenticate, reportRateLimiter, createReport);
router.get("/mine", authenticate, getMyReports);

export default router;
