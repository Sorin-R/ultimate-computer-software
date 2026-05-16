import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(2).max(50),
  categoryId: z.string().optional(),
});
