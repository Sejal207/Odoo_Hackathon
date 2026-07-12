/**
 * Assets Validators — Zod schemas for request payload validation.
 */
const { z } = require('zod');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    category_id: z.string().regex(uuidRegex, 'Invalid category_id'),
    serial_number: z.string().max(150).optional().nullable(),
    qr_code: z.string().max(255).optional().nullable(),
    acquisition_date: z.string().optional().nullable(),
    acquisition_cost: z.union([z.string(), z.number()]).optional().nullable(),
    condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional(),
    location: z.string().max(200).optional().nullable(),
    department_id: z.string().regex(uuidRegex, 'Invalid department_id').optional().nullable(),
    photo_url: z.string().optional().nullable(),
    document_urls: z.array(z.string()).optional(),
    custom_field_values: z.record(z.any()).optional(),
    is_bookable: z.boolean().optional(),
  }),
});

const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().regex(uuidRegex, 'Invalid asset id'),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    category_id: z.string().regex(uuidRegex).optional(),
    serial_number: z.string().max(150).optional().nullable(),
    qr_code: z.string().max(255).optional().nullable(),
    acquisition_date: z.string().optional().nullable(),
    acquisition_cost: z.union([z.string(), z.number()]).optional().nullable(),
    condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged']).optional(),
    location: z.string().max(200).optional().nullable(),
    department_id: z.string().regex(uuidRegex).optional().nullable(),
    photo_url: z.string().optional().nullable(),
    document_urls: z.array(z.string()).optional(),
    custom_field_values: z.record(z.any()).optional(),
    is_bookable: z.boolean().optional(),
    status: z.enum(['available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed']).optional(),
  }),
});

const getAssetByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(uuidRegex, 'Invalid asset id'),
  }),
});

module.exports = {
  createAssetSchema,
  updateAssetSchema,
  getAssetByIdSchema,
};
