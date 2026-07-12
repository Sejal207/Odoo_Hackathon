/**
 * Maintenance Validators — Zod schemas.
 */
const { z } = require('zod');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createMaintenanceSchema = z.object({
  body: z.object({
    asset_id: z.string().regex(uuidRegex, 'Invalid asset_id'),
    issue_description: z.string().min(1, 'Issue description is required'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    photo_url: z.string().optional().nullable(),
  }),
});

const maintenanceActionSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex, 'Invalid id') }),
});

const assignTechnicianSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex, 'Invalid id') }),
  body: z.object({ technician_name: z.string().min(1, 'Technician name is required') }),
});

const resolveSchema = z.object({
  params: z.object({ id: z.string().regex(uuidRegex, 'Invalid id') }),
  body: z.object({ resolution_notes: z.string().optional().nullable() }),
});

module.exports = {
  createMaintenanceSchema,
  maintenanceActionSchema,
  assignTechnicianSchema,
  resolveSchema,
};
