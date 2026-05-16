import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";
import {
  createArticleSchema,
  createArticleSchemaAdmin,
  updateArticleSchema,
  updateArticleSchemaAdmin,
} from "../validators/article";

function runValidation(schema: ZodSchema, req: Request, res: Response, next: NextFunction): void {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }
    next(err);
  }
}

export function validateCreateArticleByRole(req: Request, res: Response, next: NextFunction): void {
  const isAdmin = req.user?.role === "ADMIN";
  runValidation(isAdmin ? createArticleSchemaAdmin : createArticleSchema, req, res, next);
}

export function validateUpdateArticleByRole(req: Request, res: Response, next: NextFunction): void {
  const isAdmin = req.user?.role === "ADMIN";
  runValidation(isAdmin ? updateArticleSchemaAdmin : updateArticleSchema, req, res, next);
}

