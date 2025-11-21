import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { userSchema } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { authMiddleware, requirePrivilege } from '../middleware/auth.js';

const router = express.Router();

// Register new user (admin/manager only)
router.post('/register', authMiddleware, requirePrivilege('manage_users'), async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid user data', 
        details: error.details.map(d => d.message) 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(value.password, 10);

    // Create user
    const user = await db.transaction(async (trx) => {
      const [created] = await trx('users').insert({
        email: value.email,
        password_hash: hashedPassword,
        first_name: value.first_name,
        last_name: value.last_name,
        role: value.role,
        agency_id: value.agency_id || req.agencyId,
        privileges: value.privileges || []
      }).returning(['id', 'email', 'first_name', 'last_name', 'role', 'agency_id']);

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'create_user',
        entity_type: 'user',
        entity_id: created.id,
        changes: { email: value.email, role: value.role }
      });

      return created;
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user with agency info
    const user = await db('users')
      .select(
        'users.*',
        'agencies.name as agency_name',
        'agencies.pha_code'
      )
      .leftJoin('agencies', 'users.agency_id', 'agencies.id')
      .where('users.email', email)
      .where('users.is_active', true)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agency_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
    );

    // Remove sensitive data
    delete user.password_hash;
    delete user.mfa_secret;

    // Log successful login
    await db('audit_trails').insert({
      user_id: user.id,
      agency_id: user.agency_id,
      action: 'login',
      entity_type: 'auth',
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Get updated user info
    const user = await db('users')
      .select('id', 'email', 'role', 'agency_id')
      .where('id', decoded.userId)
      .where('is_active', true)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agency_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ accessToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db('users')
      .select(
        'users.id',
        'users.email',
        'users.first_name',
        'users.last_name',
        'users.role',
        'users.privileges',
        'users.mfa_enabled',
        'users.created_at',
        'agencies.id as agency_id',
        'agencies.name as agency_name',
        'agencies.pha_code'
      )
      .leftJoin('agencies', 'users.agency_id', 'agencies.id')
      .where('users.id', req.user.id)
      .first();

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const allowedUpdates = ['first_name', 'last_name', 'email'];
    const updates = {};
    
    for (const field of allowedUpdates) {
      if (req.body[field]) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const [updated] = await db('users')
      .where('id', req.user.id)
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning(['id', 'email', 'first_name', 'last_name']);

    res.json(updated);
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify current password
    const user = await db('users')
      .select('password_hash')
      .where('id', req.user.id)
      .first();

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db('users')
      .where('id', req.user.id)
      .update({
        password_hash: hashedPassword,
        updated_at: new Date()
      });

    // Log password change
    await db('audit_trails').insert({
      user_id: req.user.id,
      agency_id: req.agencyId,
      action: 'change_password',
      entity_type: 'user',
      entity_id: req.user.id
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// List users (admin/manager only)
router.get('/list', authMiddleware, requirePrivilege('view_users'), async (req, res) => {
  try {
    const { role, is_active, limit = 50, offset = 0 } = req.query;

    let query = db('users')
      .select(
        'users.id',
        'users.email',
        'users.first_name',
        'users.last_name',
        'users.role',
        'users.is_active',
        'users.created_at',
        'users.last_login'
      )
      .where('users.agency_id', req.agencyId)
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (role) query = query.where('role', role);
    if (is_active !== undefined) query = query.where('is_active', is_active === 'true');

    const users = await query;

    // Get total count
    const [{ total }] = await db('users')
      .count('* as total')
      .where('agency_id', req.agencyId);

    res.json({
      users,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Deactivate user (admin/manager only)
router.delete('/:id', authMiddleware, requirePrivilege('manage_users'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await db.transaction(async (trx) => {
      // Soft delete by deactivating
      await trx('users')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'deactivate_user',
        entity_type: 'user',
        entity_id: req.params.id
      });
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

export default router;