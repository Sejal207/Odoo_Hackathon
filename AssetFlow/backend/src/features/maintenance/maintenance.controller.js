/**
 * Maintenance Controller
 */
const maintService = require('./maintenance.service');
const { successResponse } = require('../../utils/response');
const { parsePagination } = require('../../shared/pagination');

const createRequest = async (req, res, next) => {
  try {
    const result = await maintService.createRequest(req.body, req.user);
    return successResponse(res, result, 201);
  } catch (e) { next(e); }
};

const approveRequest = async (req, res, next) => {
  try {
    const result = await maintService.approveRequest(req.params.id, req.user);
    return successResponse(res, result);
  } catch (e) { next(e); }
};

const rejectRequest = async (req, res, next) => {
  try {
    const result = await maintService.rejectRequest(req.params.id, req.user);
    return successResponse(res, result);
  } catch (e) { next(e); }
};

const assignTechnician = async (req, res, next) => {
  try {
    const result = await maintService.assignTechnician(req.params.id, req.body.technician_name, req.user);
    return successResponse(res, result);
  } catch (e) { next(e); }
};

const startWork = async (req, res, next) => {
  try {
    const result = await maintService.startWork(req.params.id, req.user);
    return successResponse(res, result);
  } catch (e) { next(e); }
};

const resolveRequest = async (req, res, next) => {
  try {
    const result = await maintService.resolveRequest(req.params.id, req.body || {}, req.user);
    return successResponse(res, result);
  } catch (e) { next(e); }
};

const getMaintenanceHistory = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await maintService.getMaintenanceHistory(req.params.id, limit, offset);
    return successResponse(res, {
      maintenance_requests: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

module.exports = {
  createRequest, approveRequest, rejectRequest,
  assignTechnician, startWork, resolveRequest,
  getMaintenanceHistory,
};
