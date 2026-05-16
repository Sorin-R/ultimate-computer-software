import { Router } from "express";
import {
  listPublicReadingLists,
  getMyReadingLists,
  getReadingListBySlug,
  createReadingList,
  updateReadingList,
  deleteReadingList,
  addToReadingList,
  removeFromReadingList,
  toggleFollowReadingList,
} from "../controllers/readingListController";
import { authenticate, optionalAuthenticate } from "../middleware/auth";

const router = Router();

router.get("/", optionalAuthenticate, listPublicReadingLists);
router.get("/me", authenticate, getMyReadingLists);
router.get("/:slug", optionalAuthenticate, getReadingListBySlug);
router.post("/", authenticate, createReadingList);
router.put("/:id", authenticate, updateReadingList);
router.delete("/:id", authenticate, deleteReadingList);

// Items (add / remove article from list).
router.post("/:id/items", authenticate, addToReadingList);
router.delete("/:id/items/:articleId", authenticate, removeFromReadingList);

// Follow/unfollow the list.
router.post("/:id/follow", authenticate, toggleFollowReadingList);

export default router;
