import express from 'express';
import { mailingService } from '../services/mailingService.js';
import { requirePrivilege, requireAgencyAccess } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get notifications
router.get('/', requireAgencyAccess, async (req, res) => {
    try {
        const { status } = req.query;
        const notifications = await mailingService.getNotifications(req.agencyId, { status });
        res.json(notifications);
    } catch (error) {
        logger.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Trigger manual send of pending notices
router.post('/send', requirePrivilege('admin'), async (req, res) => {
    try {
        const results = await mailingService.sendPendingNotices();
        res.json({
            message: 'Batch send completed',
            results
        });
    } catch (error) {
        logger.error('Error sending notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Generate a manual notice
router.post('/generate', requirePrivilege('create_inspection'), requireAgencyAccess, async (req, res) => {
    try {
        const { inspection_id, type } = req.body;

        if (!inspection_id || !type) {
            return res.status(400).json({ error: 'Inspection ID and type are required' });
        }

        const notification = await mailingService.generateNotice(inspection_id, type);
        res.status(201).json(notification);
    } catch (error) {
        logger.error('Error generating notice:', error);
        res.status(500).json({ error: 'Failed to generate notice' });
    }
});

export default router;
