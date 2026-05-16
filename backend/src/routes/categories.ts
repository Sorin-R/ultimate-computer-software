import { Router } from "express";
import {
  getCategories,
  getCategoriesForUser,
  getCategoryBySlug,
  createCategory,
  getTags,
  createTag,
} from "../controllers/categoryController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCategorySchema, createTagSchema } from "../validators/category";

const router = Router();

router.get("/", getCategories);
router.get("/mine", authenticate, getCategoriesForUser);
router.get("/tags", getTags);
router.post("/tags", authenticate, validate(createTagSchema), createTag);
router.get("/:slug", getCategoryBySlug);
router.post("/", authenticate, validate(createCategorySchema), createCategory);

export default router;
