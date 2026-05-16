import slugify from "slugify";
import prisma from "../config/db";

export function createSlug(text: string): string {
  return slugify(text, { lower: true, strict: true, trim: true });
}

export async function uniqueArticleSlug(keyword: string): Promise<string> {
  const base = createSlug(keyword);
  let slug = base;
  let counter = 1;

  while (await prisma.article.findUnique({ where: { slug } })) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
}

export async function uniqueCategorySlug(name: string): Promise<string> {
  const base = createSlug(name);
  let slug = base;
  let counter = 1;

  while (await prisma.category.findUnique({ where: { slug } })) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
}

export async function uniqueTagSlug(name: string): Promise<string> {
  const base = createSlug(name);
  let slug = base;
  let counter = 1;

  while (await prisma.tag.findUnique({ where: { slug } })) {
    counter++;
    slug = `${base}-${counter}`;
  }

  return slug;
}
