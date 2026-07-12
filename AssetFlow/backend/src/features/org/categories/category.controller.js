// ============================================================
// category.controller.js
// Thin controller — delegates all logic to category.service.js
// ============================================================

const categoryService = require('./category.service');
const { successResponse } = require('../../../utils/response');

const getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getCategories();
    successResponse(res, categories);
  } catch (err) { next(err); }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body, req.user.id);
    successResponse(res, category, 201);
  } catch (err) { next(err); }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body, req.user.id);
    successResponse(res, category);
  } catch (err) { next(err); }
};

const deactivateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.deactivateCategory(req.params.id, req.user.id);
    successResponse(res, { message: 'Category deactivated successfully', category });
  } catch (err) {
    if (err.meta) {
      err.message = `${err.message}`;
    }
    next(err);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deactivateCategory };
