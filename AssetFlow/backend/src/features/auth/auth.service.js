const bcrypt = require('bcrypt');
const { signToken } = require('../../config/jwt');
const { pool, query } = require('../../config/db');
const { 
  UnauthorizedError, 
  ConflictError, 
  NotFoundError, 
  UnprocessableEntityError,
  ForbiddenError
} = require('../../utils/errors');

// --- AUTHENTICATION ---

const login = async (email, password) => {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status === 'inactive') {
    throw new ForbiddenError('Inactive or deleted account');
  }

  const token = signToken({ id: user.id, role: user.role });
  
  const { password_hash, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
};

const forgotPassword = async (email) => {
  // In a real app, generate a reset token and send an email
  return true;
};

// --- USER MANAGEMENT ---

const createUser = async (data) => {
  const { name, email, password, role, department_id } = data;
  
  // Validate department exists
  const deptResult = await query('SELECT id FROM departments WHERE id = $1', [department_id]);
  if (deptResult.rows.length === 0) {
    throw new NotFoundError('Invalid department');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, department_id, status, created_at
    `;
    const result = await query(insertQuery, [name, email, hashedPassword, role, department_id]);
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Duplicate email');
    }
    throw err;
  }
};

const getUsers = async () => {
  const result = await query(`
    SELECT id, name, email, role, department_id, status, created_at 
    FROM users 
    ORDER BY created_at DESC
  `);
  return result.rows;
};

const getUserById = async (id) => {
  const result = await query(`
    SELECT id, name, email, role, department_id, status, created_at 
    FROM users WHERE id = $1
  `, [id]);
  
  const user = result.rows[0];
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

const updateUser = async (id, data) => {
  const { name, department_id } = data;
  
  if (department_id) {
    const deptResult = await query('SELECT id FROM departments WHERE id = $1', [department_id]);
    if (deptResult.rows.length === 0) {
      throw new NotFoundError('Invalid department');
    }
  }

  const result = await query(`
    UPDATE users 
    SET name = COALESCE($1, name), department_id = COALESCE($2, department_id)
    WHERE id = $3
    RETURNING id, name, email, role, department_id, status
  `, [name, department_id, id]);
  
  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  return result.rows[0];
};

const updateRole = async (id, newRole) => {
  const userResult = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  if (userResult.rows[0].role === newRole) {
    throw new ConflictError('Same role assigned again');
  }

  const result = await query(`
    UPDATE users SET role = $1 WHERE id = $2 
    RETURNING id, name, email, role, status
  `, [newRole, id]);
  
  return result.rows[0];
};

const updateStatus = async (id, newStatus) => {
  const userResult = await query('SELECT status FROM users WHERE id = $1', [id]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  if (userResult.rows[0].status === newStatus) {
    throw new ConflictError('User already in this status');
  }

  const result = await query(`
    UPDATE users SET status = $1 WHERE id = $2 
    RETURNING id, name, email, role, status
  `, [newStatus, id]);
  
  return result.rows[0];
};

const deleteUser = async (targetId, requestorId) => {
  if (targetId === requestorId) {
    throw new ConflictError('Cannot deactivate yourself');
  }
  
  const userResult = await query('SELECT status FROM users WHERE id = $1', [targetId]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  if (userResult.rows[0].status === 'inactive') {
    throw new ConflictError('User already inactive');
  }

  const result = await query(`
    UPDATE users SET status = 'inactive' WHERE id = $1 
    RETURNING id, name, email, role, status
  `, [targetId]);
  
  return result.rows[0];
};

module.exports = {
  login,
  forgotPassword,
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateRole,
  updateStatus,
  deleteUser
};
