/**
 * Audit Validators — Zod schemas.
 */
const { z } = require('zod');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createCycleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    scope_department_id: z.string().regex(uuidRegex).optional().nullable(),
    scope_location: z.string().max(200).optional().nullable(),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
  }),
});

const addAuditorsSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex) }),
  body: z.object({
    auditor_ids: z.array(z.string().regex(uuidRegex)).min(1, 'At least one auditor required'),
    asset_ids: z.array(z.string().regex(uuidRegex)).optional(),
  }),
});

const updateItemSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex) }),
  body: z.object({
    result: z.enum(['verified', 'missing', 'damaged']),
    notes: z.string().optional().nullable(),
  }),
});

const cycleIdSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex) }),
});

module.exports = { createCycleSchema, addAuditorsSchema, updateItemSchema, cycleIdSchema };
