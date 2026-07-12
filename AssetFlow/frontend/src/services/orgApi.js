// ─────────────────────────────────────────────────────────────
// orgApi.js
// All API calls for the Organisation Setup module.
// Base: /api/org/{departments|categories|employees}
// ─────────────────────────────────────────────────────────────
import apiClient from './apiClient';

// ── Departments ──────────────────────────────────────────────
export const getDepartments = () =>
  apiClient.get('/org/departments').then((r) => r.data.data);

export const createDepartment = (payload) =>
  apiClient.post('/org/departments', payload).then((r) => r.data.data);

export const updateDepartment = (id, payload) =>
  apiClient.patch(`/org/departments/${id}`, payload).then((r) => r.data.data);

export const deactivateDepartment = (id) =>
  apiClient.patch(`/org/departments/${id}/deactivate`).then((r) => r.data.data);

// ── Categories ───────────────────────────────────────────────
export const getCategories = () =>
  apiClient.get('/org/categories').then((r) => r.data.data);

export const createCategory = (payload) =>
  apiClient.post('/org/categories', payload).then((r) => r.data.data);

export const updateCategory = (id, payload) =>
  apiClient.patch(`/org/categories/${id}`, payload).then((r) => r.data.data);

export const deactivateCategory = (id) =>
  apiClient.patch(`/org/categories/${id}/deactivate`).then((r) => r.data.data);

// ── Employees ────────────────────────────────────────────────
export const getEmployees = () =>
  apiClient.get('/org/employees').then((r) => r.data.data);

export const updateEmployee = (id, payload) =>
  apiClient.patch(`/org/employees/${id}`, payload).then((r) => r.data.data);

export const updateEmployeeRole = (id, role) =>
  apiClient.patch(`/org/employees/${id}/role`, { role }).then((r) => r.data.data);

export const updateEmployeeStatus = (id, status) =>
  apiClient.patch(`/org/employees/${id}/status`, { status }).then((r) => r.data.data);
