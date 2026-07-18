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

// ─── Disponibilité (partagée : variantes, suppléments, produits) ───────────────
export const availabilityStatusSchema = z.enum(['available', 'unavailable', 'scheduled']);

export const availabilitySchema = z.object({
  status: availabilityStatusSchema.default('available'),
  // 0 = dimanche … 6 = samedi
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM').optional(),
  timeEnd: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM').optional(),
});

// ─── Variantes & options ──────────────────────────────────────────────────────
export const optionGroupKindSchema = z.enum([
  'size',
  'portion',
  'cooking',
  'flavor',
  'temperature',
  'spice',
  'supplement',
  'removable',
  'custom',
]);

export const optionChoiceSchema = z.object({
  id: z.string().min(1).max(48),
  label: z.string().min(1, 'Libellé requis').max(80),
  priceDelta: z.coerce.number().default(0),
  isDefault: z.boolean().optional(),
  // Sprint 4 — attributs par variante/supplément (tous optionnels, rétrocompatibles)
  sku: z.string().max(64).optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  prepTimeMinutes: z.coerce.number().int().min(0).max(600).optional(),
  maxQuantity: z.coerce.number().int().min(1).max(99).optional(),
  availability: availabilitySchema.optional(),
});

export const optionGroupSchema = z.object({
  id: z.string().min(1).max(48),
  name: z.string().min(1, 'Nom requis').max(80),
  kind: optionGroupKindSchema.default('custom'),
  selection: z.enum(['single', 'multiple']).default('single'),
  required: z.boolean().default(false),
  // Sprint 4 — bornes explicites de sélection (prioritaires sur selection/required)
  minChoices: z.coerce.number().int().min(0).max(40).optional(),
  maxChoices: z.coerce.number().int().min(1).max(40).optional(),
  choices: z.array(optionChoiceSchema).min(1).max(80),
});

export const itemOptionsSchema = z.array(optionGroupSchema).max(30);

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
  options: itemOptionsSchema.optional(),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial();

// ─── Import / génération IA d'un catalogue complet ────────────────────────────
export const generatedCatalogItemSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(160),
  description: z.string().max(1000).optional().default(''),
  price: z.coerce.number().min(0).default(0),
  type: catalogItemTypeSchema.default('product'),
  options: itemOptionsSchema.optional(),
  /** Public storage URL proposed during AI create preview. */
  photoUrl: z.string().max(2000).optional(),
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

export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type OptionGroupKind = z.infer<typeof optionGroupKindSchema>;
export type OptionChoiceInput = z.infer<typeof optionChoiceSchema>;
export type OptionGroupInput = z.infer<typeof optionGroupSchema>;
export type ItemOptionsInput = z.infer<typeof itemOptionsSchema>;
export type CatalogItemTypeValue = z.infer<typeof catalogItemTypeSchema>;
export type CreateCatalogCategoryInput = z.infer<typeof createCatalogCategorySchema>;
export type UpdateCatalogCategoryInput = z.infer<typeof updateCatalogCategorySchema>;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type VisitItemInput = z.infer<typeof visitItemSchema>;
export type GeneratedCatalogInput = z.infer<typeof generatedCatalogSchema>;
export type GeneratedCatalogCategoryInput = z.infer<typeof generatedCatalogCategorySchema>;
export type GeneratedCatalogItemInput = z.infer<typeof generatedCatalogItemSchema>;
