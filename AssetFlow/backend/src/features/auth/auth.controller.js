const authService = require('./auth.service');
const { successResponse } = require('../../utils/response');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await authService.login(email, password);
    successResponse(res, data, 200);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    successResponse(res, { message: 'Password reset link sent to email if it exists.' }, 200);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    // req.user is populated by authenticate middleware
    successResponse(res, req.user, 200);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await authService.createUser(req.body);
    successResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await authService.getUsers();
    successResponse(res, users, 200);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.params.id);
    successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.params.id, req.body);
    successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const user = await authService.updateRole(req.params.id, req.body.role);
    successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const user = await authService.updateStatus(req.params.id, req.body.status);
    successResponse(res, user, 200);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await authService.deleteUser(req.params.id, req.user.id);
    successResponse(res, { message: 'User deleted successfully', user }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  forgotPassword,
  getMe,
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateRole,
  updateStatus,
  deleteUser
};
