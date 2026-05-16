import { Router } from "express";
import { getMyStreak } from "../controllers/streakController";
import { authenticate } from "../middleware/auth";
import { getMyReports } from "../controllers/reportController";
import { getMyReferralOverview } from "../controllers/referralController";

// Mounted at /api/me — endpoints scoped to the authenticated user.
const router = Router();

router.get("/streak", authenticate, getMyStreak);
router.get("/reports", authenticate, getMyReports);
router.get("/referrals", authenticate, getMyReferralOverview);

export default router;
