import { Router } from "express";
import {
  listMySeries,
  createSeries,
  updateSeries,
  deleteSeries,
  getSeriesById,
} from "../controllers/articleController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Authenticated CRUD for the logged-in user's series
router.get("/", authenticate, listMySeries);
router.post("/", authenticate, createSeries);
router.put("/:id", authenticate, updateSeries);
router.delete("/:id", authenticate, deleteSeries);

// Public — fetch a single series (with members) by id
router.get("/:id", getSeriesById);

export default router;
