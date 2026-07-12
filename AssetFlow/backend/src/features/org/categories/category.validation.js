// ============================================================
// category.validation.js
// Manual validation — never trust frontend input.
// ============================================================

const { ValidationError } = require('../../../utils/errors');

const MAX_NAME_LENGTH = 150;
const MAX_DESC_LENGTH = 500;

const validateCreateCategory = (req, res, next) => {
  let { name, description } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return next(new ValidationError('Category name is required'));
  }
  name = name.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return next(new ValidationError(`Category name must be at most ${MAX_NAME_LENGTH} characters`));
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return next(new ValidationError('Description must be a string'));
    }
    description = description.trim();
    if (description.length > MAX_DESC_LENGTH) {
      return next(new ValidationError(`Description must be at most ${MAX_DESC_LENGTH} characters`));
    }
  }

  req.body.name        = name;
  req.body.description = description || null;
  next();
};

const validateUpdateCategory = (req, res, next) => {
  let { name, description } = req.body;
  const hasName = name !== undefined && name !== null;
  const hasDesc = description !== undefined && description !== null;

  if (!hasName && !hasDesc) {
    return next(new ValidationError('At least one field (name, description) must be provided'));
  }

  if (hasName) {
    if (typeof name !== 'string' || name.trim() === '') {
      return next(new ValidationError('Category name cannot be empty'));
    }
    name = name.trim();
    if (name.length > MAX_NAME_LENGTH) {
      return next(new ValidationError(`Category name must be at most ${MAX_NAME_LENGTH} characters`));
    }
    req.body.name = name;
  }

  if (hasDesc) {
    if (typeof description !== 'string') {
      return next(new ValidationError('Description must be a string'));
    }
    description = description.trim();
    if (description.length > MAX_DESC_LENGTH) {
      return next(new ValidationError(`Description must be at most ${MAX_DESC_LENGTH} characters`));
    }
    req.body.description = description;
  }

  next();
};

module.exports = { validateCreateCategory, validateUpdateCategory };
