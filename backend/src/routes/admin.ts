import { Router } from "express";
import {
  getPendingArticles,
  getAllArticlesAdmin,
  approveArticle,
  generateArticleAudioAdmin,
  rejectArticle,
  hideArticleAdmin,
  unhideArticleAdmin,
  deleteArticleAdmin,
  getUsers,
  getModeratorUsers,
  getAdminActivityLogs,
  createModeratorUser,
  updateUserRole,
  banUser,
  reactivateUser,
  deleteUserPermanently,
  toggleVerifyUser,
  getStats,
  getArticlePopularity,
  getAllCategoriesAdmin,
  updateCategoryAdmin,
  deleteCategoryAdmin,
  getAdSenseConfigs,
  createAdSenseConfig,
  updateAdSenseConfig,
  deleteAdSenseConfig,
} from "../controllers/adminController";
import {
  listReports,
  hideComment,
  restoreComment,
  dismissReport,
  deleteComment as adminDeleteComment,
} from "../controllers/commentController";
import {
  listReportsForModeration,
  updateReportForModeration,
} from "../controllers/reportController";
import { createPolicyComplianceEntry } from "../controllers/policyComplianceController";
import { authenticate, authorize } from "../middleware/auth";
import { trackAdminActivity } from "../middleware/adminActivity";

const router = Router();

router.use(authenticate, authorize("ADMIN", "MODERATOR"));
router.use(trackAdminActivity);

router.get("/stats", getStats);
router.get("/articles/popularity", getArticlePopularity);
router.get("/articles", getAllArticlesAdmin);
router.get("/articles/pending", getPendingArticles);
router.put("/articles/:id/approve", approveArticle);
router.put("/articles/:id/audio", generateArticleAudioAdmin);
router.put("/articles/:id/reject", rejectArticle);
router.put("/articles/:id/hide", hideArticleAdmin);
router.put("/articles/:id/unhide", unhideArticleAdmin);
router.delete("/articles/:id", authorize("ADMIN"), deleteArticleAdmin);
router.get("/users", getUsers);
router.get("/activity", authorize("ADMIN"), getAdminActivityLogs);
router.get("/moderators", authorize("ADMIN"), getModeratorUsers);
router.post("/moderators", authorize("ADMIN"), createModeratorUser);
router.put("/users/:id/role", authorize("ADMIN"), updateUserRole);
router.put("/users/:id/ban", banUser);
router.put("/users/:id/reactivate", reactivateUser);
router.put("/users/:id/verify", authorize("ADMIN"), toggleVerifyUser);
router.delete("/users/:id", authorize("ADMIN"), deleteUserPermanently);
router.get("/categories", authorize("ADMIN"), getAllCategoriesAdmin);
router.put("/categories/:id", authorize("ADMIN"), updateCategoryAdmin);
router.delete("/categories/:id", authorize("ADMIN"), deleteCategoryAdmin);

// Comment moderation (ADMIN + MODERATOR)
router.get("/comments/reports", listReports);
router.put("/comments/reports/:id/dismiss", dismissReport);
router.put("/comments/:id/hide", hideComment);
router.put("/comments/:id/restore", restoreComment);
router.delete("/comments/:id", adminDeleteComment);

// Trust & Safety moderation queue
router.get("/reports", listReportsForModeration);
router.put("/reports/:id", updateReportForModeration);
router.post("/users/:id/policy-compliance", createPolicyComplianceEntry);

// AdSense configuration routes (ADMIN only)
router.get("/adsense", authorize("ADMIN"), getAdSenseConfigs);
router.post("/adsense", authorize("ADMIN"), createAdSenseConfig);
router.put("/adsense/:id", authorize("ADMIN"), updateAdSenseConfig);
router.delete("/adsense/:id", authorize("ADMIN"), deleteAdSenseConfig);

export default router;
