import { Router } from "express";
import { getStories } from "../controllers/storiesController";

const router = Router();

router.get("/", getStories);

export default router;
