import { Router } from "express";
import { getPublicStats } from "../controllers/statsController";

const router = Router();

router.get("/", getPublicStats);

export default router;
