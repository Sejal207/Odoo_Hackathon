const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');
const { 
  validateLogin, 
  validateForgotPassword, 
  validateCreateUser, 
  validateUpdateRole 
} = require('./auth.validation');

// --- Auth Routes ---
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.get('/me', authenticate, authController.getMe);

// --- User Management (Admin Only) ---
router.use('/users', authenticate, authorize('admin'));
router.post('/users', validateCreateUser, authController.createUser);
router.get('/users', authController.getUsers);
router.get('/users/:id', authController.getUserById);
router.put('/users/:id', authController.updateUser);
router.patch('/users/:id/role', validateUpdateRole, authController.updateRole);
router.patch('/users/:id/status', authController.updateStatus);
router.delete('/users/:id', authController.deleteUser);

module.exports = router;
