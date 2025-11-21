import express from 'express';
import multer from 'multer';
import { requirePrivilege, requireAgencyAccess } from '../middleware/auth.js';
import externalSystemService from '../integrations/externalSystem.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Import Inspections (CSV/JSON)
router.post('/import',
    requirePrivilege('import_data'),
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const format = req.file.mimetype.includes('json') ? 'json' : 'csv';
            const content = req.file.buffer.toString('utf-8');

            const result = await externalSystemService.importInspections(
                content,
                format,
                req.agencyId,
                req.user.id
            );

            res.json({
                message: 'Import processed',
                details: result
            });
        } catch (error) {
            logger.error('Import route error:', error);
            res.status(500).json({ error: error.message || 'Import failed' });
        }
    });

// Export Inspections (CSV)
router.get('/export', requirePrivilege('export_data'), async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            batchId: req.query.batchId,
            dateFrom: req.query.dateFrom
        };

        const csv = await externalSystemService.exportInspections(req.agencyId, filters);

        res.header('Content-Type', 'text/csv');
        res.attachment(`inspections_export_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        logger.error('Export route error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

export default router;
