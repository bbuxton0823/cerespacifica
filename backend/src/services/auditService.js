import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class AuditService {
    /**
     * Log an action to the audit trail
     * @param {string} userId - ID of the user performing the action
     * @param {string} action - Short description of action (e.g., 'LOGIN', 'VIEW_REPORT')
     * @param {string} resource - Target resource (e.g., 'Inspection:123')
     * @param {object} details - Additional metadata
     * @param {string} ipAddress - User's IP address
     */
    async log(userId, action, resource, details = {}, ipAddress = '') {
        try {
            await db('audit_trails').insert({
                id: uuidv4(),
                user_id: userId,
                action,
                resource,
                details: JSON.stringify(details),
                ip_address: ipAddress,
                created_at: new Date()
            });
        } catch (error) {
            // Don't throw, just log to file so we don't break the app flow
            logger.error('Failed to write audit log:', error);
        }
    }
}

export const auditService = new AuditService();
