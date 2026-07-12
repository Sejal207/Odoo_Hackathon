// ============================================================
// employee.controller.js
// Thin controller — delegates all logic to employee.service.js
// ============================================================

const employeeService = require('./employee.service');
const { successResponse } = require('../../../utils/response');

// GET /api/org/employees
const getEmployees = async (req, res, next) => {
  try {
    const employees = await employeeService.getEmployees();
    successResponse(res, employees);
  } catch (err) { next(err); }
};

// PATCH /api/org/employees/:id
const updateEmployee = async (req, res, next) => {
  try {
    const employee = await employeeService.updateEmployee(req.params.id, req.body, req.user.id);
    successResponse(res, employee);
  } catch (err) { next(err); }
};

// PATCH /api/org/employees/:id/role
const updateRole = async (req, res, next) => {
  try {
    const employee = await employeeService.updateRole(req.params.id, req.body.role, req.user.id);
    successResponse(res, employee);
  } catch (err) { next(err); }
};

// PATCH /api/org/employees/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const employee = await employeeService.updateStatus(req.params.id, req.body.status, req.user.id);
    successResponse(res, employee);
  } catch (err) { next(err); }
};

module.exports = { getEmployees, updateEmployee, updateRole, updateStatus };
