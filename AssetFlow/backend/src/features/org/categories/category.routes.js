// ============================================================
// category.routes.js
// RBAC:
//   GET  → admin, asset_manager, department_head
//   POST, PATCH, DEACTIVATE → admin only
// ============================================================

const express = require('express');
const router  = express.Router();

const authenticate = require('../../../middlewares/auth.middleware');
const authorize    = require('../../../middlewares/rbac.middleware');
const { ROLES }    = require('../../../utils/constants');

const categoryController = require('./category.controller');
const { validateCreateCategory, validateUpdateCategory } = require('./category.validation');

router.use(authenticate);

// GET /api/org/categories
router.get('/',
  authorize(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.DEPARTMENT_HEAD),
  categoryController.getCategories
);

// POST /api/org/categories
router.post('/',
  authorize(ROLES.ADMIN),
  validateCreateCategory,
  categoryController.createCategory
);

// PATCH /api/org/categories/:id
router.patch('/:id',
  authorize(ROLES.ADMIN),
  validateUpdateCategory,
  categoryController.updateCategory
);

// PATCH /api/org/categories/:id/deactivate
router.patch('/:id/deactivate',
  authorize(ROLES.ADMIN),
  categoryController.deactivateCategory
);

module.exports = router;
