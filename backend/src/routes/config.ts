import { Router } from "express";
import {
  getAdSenseConfig,
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
} from "../controllers/configController";
import { authenticate, authorize } from "../middleware/auth";
import { trackAdminActivity } from "../middleware/adminActivity";

const router = Router();

// Public routes
router.get("/adsense", getAdSenseConfig);

// Admin routes
router.get("/admin/ads", authenticate, authorize("ADMIN"), getAllAds);
router.post("/admin/ads", authenticate, authorize("ADMIN"), trackAdminActivity, createAd);
router.put("/admin/ads/:id", authenticate, authorize("ADMIN"), trackAdminActivity, updateAd);
router.delete("/admin/ads/:id", authenticate, authorize("ADMIN"), trackAdminActivity, deleteAd);
router.put("/admin/ads/:id/toggle", authenticate, authorize("ADMIN"), trackAdminActivity, toggleAdStatus);

export default router;
