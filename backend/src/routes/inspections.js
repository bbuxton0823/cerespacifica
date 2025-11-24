import express from 'express';
import db from '../config/database.js';
import { requirePrivilege, requireAgencyAccess } from '../middleware/auth.js';
import { validateInspectionData } from '../utils/validators.js';
import syncService from '../services/syncService.js';
import { schedulingService } from '../services/schedulingService.js';
import { mailingService } from '../services/mailingService.js';
import { reportService } from '../services/reportService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all inspections for agency
router.get('/', async (req, res) => {
  try {
    const { status, inspector_id, unit_id, from_date, to_date, limit = 50, offset = 0 } = req.query;

    let query = db('inspections')
      .select(
        'inspections.*',
        'units.address',
        'units.tenant_name',
        'users.first_name as inspector_first_name',
        'users.last_name as inspector_last_name'
      )
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .leftJoin('users', 'inspections.inspector_id', 'users.id')
      .where('inspections.agency_id', req.agencyId)
      .orderBy('inspections.inspection_date', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) query = query.where('inspections.status', status);
    if (inspector_id) query = query.where('inspections.inspector_id', inspector_id);
    if (unit_id) query = query.where('inspections.unit_id', unit_id);
    if (from_date) query = query.where('inspections.inspection_date', '>=', from_date);
    if (to_date) query = query.where('inspections.inspection_date', '<=', to_date);

    const inspections = await query;

    // Get total count for pagination
    const countQuery = db('inspections')
      .count('* as total')
      .where('agency_id', req.agencyId);

    if (status) countQuery.where('status', status);
    if (inspector_id) countQuery.where('inspector_id', inspector_id);
    if (unit_id) countQuery.where('unit_id', unit_id);
    if (from_date) countQuery.where('inspection_date', '>=', from_date);
    if (to_date) countQuery.where('inspection_date', '<=', to_date);

    const [{ total }] = await countQuery;

    res.json({
      inspections,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching inspections:', error);
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

// Get single inspection
router.get('/:id', requireAgencyAccess, async (req, res) => {
  try {
    const inspection = await db('inspections')
      .select(
        'inspections.*',
        'units.*',
        'users.first_name as inspector_first_name',
        'users.last_name as inspector_last_name'
      )
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .leftJoin('users', 'inspections.inspector_id', 'users.id')
      .where('inspections.id', req.params.id)
      .where('inspections.agency_id', req.agencyId)
      .first();

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Get associated deficiencies
    const deficiencies = await db('deficiencies')
      .where('inspection_id', inspection.id)
      .orderBy('is_24hour', 'desc')
      .orderBy('created_at', 'asc');

    res.json({
      ...inspection,
      deficiencies
    });
  } catch (error) {
    logger.error('Error fetching inspection:', error);
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// Auto-route inspections
router.post('/auto-route', requireAgencyAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const result = await schedulingService.autoRoute(
      req.agencyId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json(result);
  } catch (error) {
    logger.error('Error auto-routing:', error);
    res.status(500).json({ error: error.message || 'Auto-routing failed' });
  }
});

// Create new inspection
router.post('/', requirePrivilege('create_inspection'), async (req, res) => {
  try {
    const inspectionData = req.body;

    // Validate inspection data
    const validation = await validateInspectionData(inspectionData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid inspection data',
        details: validation.errors
      });
    }

    const inspection = await db.transaction(async (trx) => {
      // Create inspection
      const [created] = await trx('inspections').insert({
        unit_id: inspectionData.unit_id,
        inspector_id: req.user.id,
        agency_id: req.agencyId,
        inspection_type: inspectionData.inspection_type,
        status: inspectionData.status || 'draft',
        data: inspectionData.data,
        inspection_date: inspectionData.inspection_date || new Date(),
        t_code: inspectionData.t_code,
        external_system_id: inspectionData.external_system_id,
        signature_tenant: inspectionData.signature_tenant,
        signature_owner: inspectionData.signature_owner,
        signature_inspector: inspectionData.signature_inspector
      }).returning('*');

      // Extract and save deficiencies
      const deficiencies = await syncService.extractDeficiencies(
        trx,
        created.id,
        inspectionData.data
      );

      // Check for 24-hour emergency fails
      const emergencyFails = await syncService.check24HourFails(
        trx,
        created.id,
        inspectionData.data
      );

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'create_inspection',
        entity_type: 'inspection',
        entity_id: created.id,
        changes: { inspectionData }
      });

      return {
        ...created,
        deficiencies,
        emergencyFails
      };
    });

    res.status(201).json(inspection);
  } catch (error) {
    logger.error('Error creating inspection:', error);
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// Update inspection
router.put('/:id', requirePrivilege('edit_inspection'), requireAgencyAccess, async (req, res) => {
  try {
    const inspectionData = req.body;

    // Validate inspection data
    const validation = await validateInspectionData(inspectionData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid inspection data',
        details: validation.errors
      });
    }

    const updated = await db.transaction(async (trx) => {
      // Get existing inspection
      const existing = await trx('inspections')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .first();

      if (!existing) {
        throw new Error('Inspection not found');
      }

      // Update inspection
      const [updated] = await trx('inspections')
        .where('id', req.params.id)
        .update({
          ...inspectionData,
          updated_at: new Date()
        })
        .returning('*');

      // Re-extract deficiencies
      await trx('deficiencies').where('inspection_id', req.params.id).delete();
      const deficiencies = await syncService.extractDeficiencies(
        trx,
        req.params.id,
        inspectionData.data
      );

      // Re-check for 24-hour emergency fails
      const emergencyFails = await syncService.check24HourFails(
        trx,
        req.params.id,
        inspectionData.data
      );

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'update_inspection',
        entity_type: 'inspection',
        entity_id: req.params.id,
        changes: {
          before: existing,
          after: inspectionData
        }
      });

      return {
        ...updated,
        deficiencies,
        emergencyFails
      };
    });

    res.json(updated);
  } catch (error) {
    logger.error('Error updating inspection:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// Sync offline inspections
router.post('/sync', async (req, res) => {
  try {
    const syncData = req.body;

    if (!syncData.deviceId || !syncData.changes || !syncData.clientTimestamp) {
      return res.status(400).json({
        error: 'Invalid sync data format'
      });
    }

    const result = await syncService.processSync(
      req.user.id,
      req.agencyId,
      syncData
    );

    res.json(result);
  } catch (error) {
    logger.error('Error syncing inspections:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Complete inspection
router.post('/:id/complete', requirePrivilege('complete_inspection'), requireAgencyAccess, async (req, res) => {
  try {
    const { signature_inspector } = req.body;

    const updated = await db.transaction(async (trx) => {
      // Update inspection status
      const [inspection] = await trx('inspections')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .update({
          status: 'complete',
          completed_at: new Date(),
          signature_inspector,
          updated_at: new Date()
        })
        .returning('*');

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'complete_inspection',
        entity_type: 'inspection',
        entity_id: req.params.id,
        changes: { signature_inspector }
      });

      return inspection;
    });

    res.json(updated);
  } catch (error) {
    logger.error('Error completing inspection:', error);
    res.status(500).json({ error: 'Failed to complete inspection' });
  }
});

// Delete/Cancel inspection
router.delete('/:id', requirePrivilege('delete_inspection'), requireAgencyAccess, async (req, res) => {
  try {
    await db.transaction(async (trx) => {
      // Soft delete by updating status
      await trx('inspections')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .update({
          status: 'cancelled',
          updated_at: new Date()
        });

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'cancel_inspection',
        entity_type: 'inspection',
        entity_id: req.params.id
      });
    });

    res.json({ message: 'Inspection cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling inspection:', error);
    res.status(500).json({ error: 'Failed to cancel inspection' });
  }
});

// Reschedule inspection
router.post('/:id/reschedule', requirePrivilege('edit_inspection'), requireAgencyAccess, async (req, res) => {
  try {
    const { new_date, reason } = req.body;

    if (!new_date) {
      return res.status(400).json({ error: 'New date is required' });
    }

    await schedulingService.rescheduleInspection(req.params.id, new_date, reason);

    // Add to audit trail
    await db('audit_trails').insert({
      user_id: req.user.id,
      agency_id: req.agencyId,
      action: 'reschedule_inspection',
      entity_type: 'inspection',
      entity_id: req.params.id,
      changes: { new_date, reason }
    });

    res.json({ message: 'Inspection rescheduled successfully' });
  } catch (error) {
    logger.error('Error rescheduling inspection:', error);
    res.status(500).json({ error: error.message || 'Failed to reschedule inspection' });
  }
});

// Process inspection result (Pass/Fail)
router.post('/:id/result', requirePrivilege('complete_inspection'), requireAgencyAccess, async (req, res) => {
  try {
    const { passed, deficiencies } = req.body;

    if (passed === undefined) {
      return res.status(400).json({ error: 'Result (passed) is required' });
    }

    await schedulingService.processInspectionResult(req.params.id, passed, deficiencies);

    // Trigger failure notice if failed
    if (!passed) {
      await mailingService.generateNotice(req.params.id, 'Failure_Notice');
    }

    res.json({ message: 'Inspection result processed successfully' });
  } catch (error) {
    logger.error('Error processing inspection result:', error);
    res.status(500).json({ error: error.message || 'Failed to process inspection result' });
  }
});

// Sync inspection results (Mobile App -> Cloud)
router.post('/:id/sync', requirePrivilege('update_inspection'), async (req, res) => {
  try {
    const { result, fail_items, photos, notes } = req.body;

    // Update inspection
    await db('inspections')
      .where({ id: req.params.id })
      .update({
        result,
        fail_items: JSON.stringify(fail_items), // Store as JSON
        notes,
        status: 'Completed',
        completed_at: new Date(),
        updated_at: new Date()
      });

    // Trigger post-inspection logic (e.g. mailing)
    if (result === 'Fail') {
      await schedulingService.processResult(req.params.id, result);
    }

    res.json({ message: 'Inspection synced successfully' });
  } catch (error) {
    logger.error('Error syncing inspection:', error);
    res.status(500).json({ error: 'Failed to sync inspection' });
  }
});

// Download HUD-52580 PDF
router.get('/:id/report', requirePrivilege('read_inspection'), async (req, res) => {
  try {
    const pdfBuffer = await reportService.generateHUD52580(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=inspection-${req.params.id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Batch Export to Excel
router.get('/batch/export', requirePrivilege('read_inspection'), async (req, res) => {
  try {
    // In a real app, we'd filter by date/status from query params
    // For now, export all 'Completed' inspections
    const inspections = await db('inspections')
      .where('status', 'Completed')
      .select('id');

    const ids = inspections.map(i => i.id);
    const excelBuffer = await reportService.generateBatchExport(ids);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inspections_export.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Error exporting batch:', error);
    res.status(500).json({ error: 'Failed to export batch' });
  }
});

export default router;