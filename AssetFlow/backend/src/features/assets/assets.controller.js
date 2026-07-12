/**
 * Assets Controller — thin layer: parse request, call service, return envelope.
 */
const assetsService = require('./assets.service');
const { successResponse } = require('../../utils/response');
const { parsePagination } = require('../../shared/pagination');

const createAsset = async (req, res, next) => {
  try {
    const asset = await assetsService.createAsset(req.body, req.user);
    return successResponse(res, asset, 201);
  } catch (error) {
    next(error);
  }
};

const getAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const filters = {
      tag: req.query.tag,
      serial: req.query.serial,
      category: req.query.category,
      status: req.query.status,
      department: req.query.department,
      location: req.query.location,
      is_bookable: req.query.is_bookable,
    };
    const { rows, total } = await assetsService.listAssets(filters, limit, offset);
    return successResponse(res, {
      assets: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getMetadata = async (req, res, next) => {
  try {
    const metadata = await assetsService.getMetadata();
    return successResponse(res, metadata);
  } catch (error) {
    next(error);
  }
};

const getAssetById = async (req, res, next) => {
  try {
    const asset = await assetsService.getAssetById(req.params.id);
    return successResponse(res, asset);
  } catch (error) {
    next(error);
  }
};

const updateAsset = async (req, res, next) => {
  try {
    const asset = await assetsService.updateAsset(req.params.id, req.body, req.user);
    return successResponse(res, asset);
  } catch (error) {
    next(error);
  }
};

const getAssetHistory = async (req, res, next) => {
  try {
    const history = await assetsService.getAssetHistory(req.params.id);
    return successResponse(res, history);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAsset,
  getAssets,
  getMetadata,
  getAssetById,
  updateAsset,
  getAssetHistory,
};
