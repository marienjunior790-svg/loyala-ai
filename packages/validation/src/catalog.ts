import { z } from 'zod';

export const catalogItemTypeSchema = z.enum(['product', 'service', 'rental']);

const optionalNumber = z
  .union([z.coerce.number(), z.literal(''), z.undefined(), z.null()])
  .transform((v) => (v === '' || v === undefined || v === null ? undefined : v));

// ─── Catégories ──────────────────────────────────────────────────────────────
export const createCatalogCategorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateCatalogCategorySchema = createCatalogCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Articles ────────────────────────────────────────────────────────────────
export const createCatalogItemSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(160),
  description: z.string().max(1000).optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  type: catalogItemTypeSchema.default('product'),
  price: z.coerce.number().min(0, 'Prix invalide'),
  currency: z.string().min(1).max(8).default('XOF'),
  taxRate: optionalNumber.pipe(z.number().min(0).max(100).optional()),
  isActive: z.boolean().default(true),
  sku: z.string().max(64).optional().or(z.literal('')),
  photoUrl: z.string().url().optional().or(z.literal('')),
  durationMinutes: optionalNumber.pipe(z.number().int().min(0).optional()),
  stock: optionalNumber.pipe(z.number().int().optional()),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial();

// ─── Import / génération IA d'un catalogue complet ────────────────────────────
export const generatedCatalogItemSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(160),
  description: z.string().max(1000).optional().default(''),
  price: z.coerce.number().min(0).default(0),
  type: catalogItemTypeSchema.default('product'),
});

export const generatedCatalogCategorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(120),
  description: z.string().max(500).optional().default(''),
  items: z.array(generatedCatalogItemSchema).max(100).default([]),
});

export const generatedCatalogSchema = z.object({
  currency: z.string().min(1).max(8).default('XOF'),
  categories: z.array(generatedCatalogCategorySchema).max(40).default([]),
});

// ─── Ligne d'achat (visite) ──────────────────────────────────────────────────
export const visitItemSchema = z.object({
  catalogItemId: z.string().uuid().optional().or(z.literal('')),
  name: z.string().min(1, 'Nom requis').max(160),
  categoryName: z.string().max(120).optional().or(z.literal('')),
  itemType: catalogItemTypeSchema.optional(),
  quantity: z.coerce.number().positive('Quantité invalide'),
  unitPrice: z.coerce.number().min(0, 'Prix invalide'),
});

export type CatalogItemTypeValue = z.infer<typeof catalogItemTypeSchema>;
export type CreateCatalogCategoryInput = z.infer<typeof createCatalogCategorySchema>;
export type UpdateCatalogCategoryInput = z.infer<typeof updateCatalogCategorySchema>;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type VisitItemInput = z.infer<typeof visitItemSchema>;
export type GeneratedCatalogInput = z.infer<typeof generatedCatalogSchema>;
export type GeneratedCatalogCategoryInput = z.infer<typeof generatedCatalogCategorySchema>;
export type GeneratedCatalogItemInput = z.infer<typeof generatedCatalogItemSchema>;
