/**
 * Audit Controller
 */
const auditService = require('./audit.service');
const { successResponse } = require('../../utils/response');
const { parsePagination } = require('../../shared/pagination');

const createCycle = async (req, res, next) => {
  try {
    const cycle = await auditService.createCycle(req.body, req.user);
    return successResponse(res, cycle, 201);
  } catch (e) { next(e); }
};

const addAuditors = async (req, res, next) => {
  try {
    const result = await auditService.addAuditors(
      req.params.id, req.body.auditor_ids, req.body.asset_ids, req.user
    );
    return successResponse(res, result, 201);
  } catch (e) { next(e); }
};

const getItems = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await auditService.getItems(req.params.id, limit, offset);
    return successResponse(res, {
      items: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

const updateItem = async (req, res, next) => {
  try {
    const item = await auditService.updateItem(req.params.id, req.body, req.user);
    return successResponse(res, item);
  } catch (e) { next(e); }
};

const closeCycle = async (req, res, next) => {
  try {
    const cycle = await auditService.closeCycle(req.params.id, req.user);
    return successResponse(res, cycle);
  } catch (e) { next(e); }
};

const getDiscrepancyReport = async (req, res, next) => {
  try {
    const report = await auditService.getDiscrepancyReport(req.params.id);
    return successResponse(res, report);
  } catch (e) { next(e); }
};

module.exports = { createCycle, addAuditors, getItems, updateItem, closeCycle, getDiscrepancyReport };
