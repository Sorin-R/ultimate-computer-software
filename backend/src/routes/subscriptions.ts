import { Router } from "express";
import {
  followUser,
  unfollowUser,
  muteCreator,
  unmuteCreator,
  blockSubscriber,
  unblockSubscriber,
  listMySubscriptions,
  listMySubscribers,
  getCreatorStats,
} from "../controllers/subscriptionController";
import { blockUser, unblockUser, listBlockedUsers } from "../controllers/userBlockController";
import {
  listNotifications,
  unreadCount,
  markRead,
  deleteNotification,
} from "../controllers/notificationController";
import {
  getAuthorProfile,
  updateMyProfile,
  setPinnedArticle,
} from "../controllers/authorController";
import { getPublicPolicyCompliance } from "../controllers/policyComplianceController";
import { getUserBadges } from "../controllers/streakController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

// ----- Follow / mute / block (subscription mutations) -----
// Mounted under /api/users (so they read like /users/:id/follow).
const usersRouter = Router();
usersRouter.get("/:id/profile", optionalAuthenticate, getAuthorProfile);
usersRouter.get("/:id/policy-compliance", getPublicPolicyCompliance);
// K8: public badge list for any user — used by avatars + bylines.
usersRouter.get("/:id/badges", getUserBadges);
usersRouter.post("/:id/follow", authenticate, followUser);
usersRouter.delete("/:id/follow", authenticate, unfollowUser);
usersRouter.post("/:id/mute", authenticate, muteCreator);
usersRouter.post("/:id/unmute", authenticate, unmuteCreator);
usersRouter.post("/:id/block", authenticate, blockUser);
usersRouter.delete("/:id/block", authenticate, unblockUser);

// ----- "Me" routes (current authenticated user) -----
const meRouter = Router();
meRouter.use(authenticate);
meRouter.get("/subscriptions", listMySubscriptions);
meRouter.get("/subscribers", listMySubscribers);
meRouter.get("/creator-stats", getCreatorStats);
meRouter.get("/blocks", listBlockedUsers);
meRouter.put("/profile", updateMyProfile);
meRouter.put("/pinned-article", setPinnedArticle);
meRouter.post("/blocks/:userId", blockSubscriber);
meRouter.delete("/blocks/:userId", unblockSubscriber);
// Notifications
meRouter.get("/notifications", listNotifications);
meRouter.get("/notifications/unread-count", unreadCount);
meRouter.post("/notifications/read", markRead);
meRouter.delete("/notifications/:id", deleteNotification);

router.use("/users", usersRouter);
router.use("/me", meRouter);

export default router;
