/**
 * Allocation Controller — thin layer: parse request, call service, return envelope.
 */
const allocService = require('./allocation.service');
const { successResponse } = require('../../utils/response');
const { parsePagination } = require('../../shared/pagination');

const createAllocation = async (req, res, next) => {
  try {
    const allocation = await allocService.createAllocation(req.body, req.user);
    return successResponse(res, allocation, 201);
  } catch (error) {
    next(error);
  }
};

const returnAllocation = async (req, res, next) => {
  try {
    const allocation = await allocService.returnAllocation(req.params.id, req.body, req.user);
    return successResponse(res, allocation);
  } catch (error) {
    next(error);
  }
};

const getAllocations = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const filters = {
      overdue: req.query.overdue,
      asset_id: req.query.asset_id,
      employee_id: req.query.employee_id,
      status: req.query.status,
    };
    const { rows, total } = await allocService.listAllocations(filters, limit, offset);
    return successResponse(res, {
      allocations: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const createTransferRequest = async (req, res, next) => {
  try {
    const transfer = await allocService.createTransferRequest(req.body, req.user);
    return successResponse(res, transfer, 201);
  } catch (error) {
    next(error);
  }
};

const approveTransfer = async (req, res, next) => {
  try {
    const result = await allocService.approveTransfer(req.params.id, req.user);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

const rejectTransfer = async (req, res, next) => {
  try {
    const result = await allocService.rejectTransfer(req.params.id, req.user);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

const directTransfer = async (req, res, next) => {
  try {
    const result = await allocService.directTransfer(req.body, req.user);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAllocation,
  returnAllocation,
  getAllocations,
  createTransferRequest,
  approveTransfer,
  rejectTransfer,
  directTransfer,
};
