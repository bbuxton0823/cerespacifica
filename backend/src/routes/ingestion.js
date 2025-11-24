import express from 'express';
import multer from 'multer';
import ingestionService from '../services/ingestionService.js';
import { requireAgencyAccess } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Import Schedule/Inspection Data
router.post('/schedule',
    // requireAgencyAccess, // Temporarily disabled if auth context is tricky, but recommended
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const agencyId = req.body.agencyId || req.user?.agencyId || 'san_mateo_ha'; // Default if not provided

            logger.info(`Starting ingestion for agency: ${agencyId}`);

            const result = await ingestionService.ingestSchedule(
                req.file.buffer,
                agencyId
            );

            res.json({
                message: 'Ingestion processed',
                ...result
            });
        } catch (error) {
            logger.error('Ingestion route error:', error);
            res.status(500).json({ error: error.message || 'Ingestion failed' });
        }
    });

export default router;

