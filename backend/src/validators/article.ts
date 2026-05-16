import { z } from "zod";

const optionalSourceUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional();
const optionalNullableString = z.string().optional().or(z.null());
const optionalDateString = z.string().datetime().optional().or(z.literal("")).or(z.null());
const articleType = z.enum(["ARTICLE", "AMA", "DISCUSSION"]).optional();

export const createArticleSchema = z.object({
  title: z.string().min(5).max(255),
  body: z.string().min(20),
  categoryId: z.string().min(1),
  authorName: z.string().max(100).optional(),
  originalSourceUrl: optionalSourceUrl,
  mainKeyword: z.string().min(2).max(100),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  imageUrl: z.string().optional().or(z.null()),
  articleType,
  amaExpiresAt: optionalDateString,
});

export const updateArticleSchema = createArticleSchema.partial().extend({
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
});

export const createArticleSchemaAdmin = z.object({
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  categoryId: z.string().optional(),
  authorName: z.string().max(100).optional(),
  originalSourceUrl: optionalNullableString,
  mainKeyword: z.string().max(100).optional(),
  tagIds: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "SCHEDULED"]).optional(),
  scheduledAt: optionalDateString,
  imageUrl: z.string().optional().or(z.null()),
  articleType,
  amaExpiresAt: optionalDateString,
  isPinnedToHome: z.boolean().optional(),
});

export const updateArticleSchemaAdmin = createArticleSchemaAdmin.partial().extend({
  status: z.enum(["DRAFT", "SUBMITTED", "SCHEDULED"]).optional(),
});
