import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import db from '../config/database.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user with agency info
    const user = await db('users')
      .select('users.*', 'agencies.name as agency_name')
      .leftJoin('agencies', 'users.agency_id', 'agencies.id')
      .where('users.id', decoded.userId)
      .where('users.is_active', true)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    req.agencyId = user.agency_id;
    
    // Log access for audit trail
    await db('audit_trails').insert({
      user_id: user.id,
      agency_id: user.agency_id,
      action: `${req.method} ${req.originalUrl}`,
      entity_type: 'api_access',
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// RBAC middleware to check specific privileges
export const requirePrivilege = (privilege) => {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Managers have all privileges
    if (user.role === 'manager') {
      return next();
    }

    // Check if user has specific privilege
    const privileges = user.privileges || [];
    if (!privileges.includes(privilege)) {
      logger.warn(`User ${user.id} attempted unauthorized action: ${privilege}`);
      return res.status(403).json({ error: 'Insufficient privileges' });
    }

    next();
  };
};

// Agency isolation middleware
export const requireAgencyAccess = async (req, res, next) => {
  try {
    const entityId = req.params.id;
    const entityType = req.baseUrl.split('/').pop(); // Get entity type from URL
    
    if (!entityId) {
      return next();
    }

    // Check if the entity belongs to user's agency
    let hasAccess = false;
    
    switch(entityType) {
      case 'inspections':
        hasAccess = await db('inspections')
          .where('id', entityId)
          .where('agency_id', req.agencyId)
          .first();
        break;
      case 'units':
        hasAccess = await db('units')
          .where('id', entityId)
          .where('agency_id', req.agencyId)
          .first();
        break;
      case 'schedules':
        hasAccess = await db('schedules')
          .where('id', entityId)
          .where('agency_id', req.agencyId)
          .first();
        break;
      default:
        hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied - resource not in your agency' });
    }

    next();
  } catch (error) {
    logger.error('Agency access check error:', error);
    res.status(500).json({ error: 'Access verification failed' });
  }
};