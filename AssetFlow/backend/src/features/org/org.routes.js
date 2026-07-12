// ============================================================
// org.routes.js
// Index router for the Organisation Setup Module.
// Mounts sub-routers at:
//   /api/org/departments
//   /api/org/categories
//   /api/org/employees
// ============================================================

const express = require('express');
const router  = express.Router();

const departmentRoutes = require('./departments/department.routes');
const categoryRoutes   = require('./categories/category.routes');
const employeeRoutes   = require('./employees/employee.routes');

router.use('/departments', departmentRoutes);
router.use('/categories',  categoryRoutes);
router.use('/employees',   employeeRoutes);

module.exports = router;
