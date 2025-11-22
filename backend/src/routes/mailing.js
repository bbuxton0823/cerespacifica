import express from 'express';
import { mailingService } from '../services/mailingService.js';
import { letterService } from '../services/letterService.js';
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

// Generate Word Letter
router.post('/letter', requirePrivilege('read_inspection'), async (req, res) => {
    try {
        const { inspectionId, type } = req.body;
        if (!inspectionId || !type) {
            return res.status(400).json({ error: 'Missing inspectionId or type' });
        }

        const buffer = await letterService.generateLetterForInspection(inspectionId, type);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=letter_${type}_${inspectionId}.docx`);
        res.send(buffer);
    } catch (error) {
        logger.error('Error generating letter:', error);
        res.status(500).json({ error: 'Failed to generate letter' });
    }
});

export default router;
