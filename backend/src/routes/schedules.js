import express from 'express';
import db from '../config/database.js';
import { requirePrivilege, requireAgencyAccess } from '../middleware/auth.js';
import { scheduleSchema } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { emitToAgency, emitToUser } from '../services/socketService.js';

const router = express.Router();

// Get schedules
router.get('/', async (req, res) => {
  try {
    const { inspector_id, date, from_date, to_date, status, limit = 50, offset = 0 } = req.query;
    
    let query = db('schedules')
      .select(
        'schedules.*',
        'inspections.unit_id',
        'inspections.inspection_type',
        'units.address',
        'units.city',
        'units.tenant_name',
        'users.first_name as inspector_first_name',
        'users.last_name as inspector_last_name'
      )
      .leftJoin('inspections', 'schedules.inspection_id', 'inspections.id')
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .leftJoin('users', 'schedules.inspector_id', 'users.id')
      .where('schedules.agency_id', req.agencyId)
      .orderBy('schedules.scheduled_date', 'asc')
      .orderBy('schedules.scheduled_time', 'asc')
      .limit(limit)
      .offset(offset);

    // Apply filters
    if (inspector_id) {
      // Inspectors can only see their own schedules unless they have view_all_schedules privilege
      if (inspector_id === req.user.id || req.user.role === 'manager' || 
          req.user.privileges?.includes('view_all_schedules')) {
        query = query.where('schedules.inspector_id', inspector_id);
      } else {
        return res.status(403).json({ error: 'Cannot view other inspector schedules' });
      }
    }
    
    if (date) query = query.where('schedules.scheduled_date', date);
    if (from_date) query = query.where('schedules.scheduled_date', '>=', from_date);
    if (to_date) query = query.where('schedules.scheduled_date', '<=', to_date);
    if (status) query = query.where('schedules.status', status);

    const schedules = await query;

    // Get total count for pagination
    const countQuery = db('schedules')
      .count('* as total')
      .where('agency_id', req.agencyId);
    
    if (inspector_id) countQuery.where('inspector_id', inspector_id);
    if (date) countQuery.where('scheduled_date', date);
    if (from_date) countQuery.where('scheduled_date', '>=', from_date);
    if (to_date) countQuery.where('scheduled_date', '<=', to_date);
    if (status) countQuery.where('status', status);
    
    const [{ total }] = await countQuery;

    res.json({
      schedules,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get single schedule
router.get('/:id', requireAgencyAccess, async (req, res) => {
  try {
    const schedule = await db('schedules')
      .select(
        'schedules.*',
        'inspections.*',
        'units.*',
        'users.first_name as inspector_first_name',
        'users.last_name as inspector_last_name'
      )
      .leftJoin('inspections', 'schedules.inspection_id', 'inspections.id')
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .leftJoin('users', 'schedules.inspector_id', 'users.id')
      .where('schedules.id', req.params.id)
      .where('schedules.agency_id', req.agencyId)
      .first();

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create schedule
router.post('/', requirePrivilege('create_schedule'), async (req, res) => {
  try {
    const { error, value } = scheduleSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid schedule data', 
        details: error.details.map(d => d.message) 
      });
    }

    const schedule = await db.transaction(async (trx) => {
      // Check if inspection exists and belongs to agency
      if (value.inspection_id) {
        const inspection = await trx('inspections')
          .where('id', value.inspection_id)
          .where('agency_id', req.agencyId)
          .first();
        
        if (!inspection) {
          throw new Error('Inspection not found');
        }
      }

      // Check for schedule conflicts
      const conflicts = await trx('schedules')
        .where('inspector_id', value.inspector_id)
        .where('scheduled_date', value.scheduled_date)
        .where('scheduled_time', value.scheduled_time)
        .where('status', '!=', 'cancelled')
        .first();

      if (conflicts) {
        throw new Error('Schedule conflict - inspector already has an appointment at this time');
      }

      // Create schedule
      const [created] = await trx('schedules').insert({
        ...value,
        agency_id: req.agencyId,
        status: 'scheduled'
      }).returning('*');

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'create_schedule',
        entity_type: 'schedule',
        entity_id: created.id,
        changes: value
      });

      return created;
    });

    // Notify inspector via socket
    emitToUser(schedule.inspector_id, 'schedule:new', {
      scheduleId: schedule.id,
      date: schedule.scheduled_date,
      time: schedule.scheduled_time,
      createdBy: req.user.id
    });

    // Broadcast to agency
    emitToAgency(req.agencyId, 'schedule:created', {
      scheduleId: schedule.id,
      inspectorId: schedule.inspector_id,
      date: schedule.scheduled_date
    });

    res.status(201).json(schedule);
  } catch (error) {
    logger.error('Error creating schedule:', error);
    res.status(500).json({ error: error.message || 'Failed to create schedule' });
  }
});

// Batch create schedules
router.post('/batch', requirePrivilege('create_schedule'), async (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'Schedules array required' });
    }

    const created = await db.transaction(async (trx) => {
      const results = [];
      
      for (const scheduleData of schedules) {
        const { error, value } = scheduleSchema.validate(scheduleData);
        
        if (error) {
          throw new Error(`Invalid schedule data: ${error.message}`);
        }

        // Check for conflicts
        const conflicts = await trx('schedules')
          .where('inspector_id', value.inspector_id)
          .where('scheduled_date', value.scheduled_date)
          .where('scheduled_time', value.scheduled_time)
          .where('status', '!=', 'cancelled')
          .first();

        if (!conflicts) {
          const [schedule] = await trx('schedules').insert({
            ...value,
            agency_id: req.agencyId,
            status: 'scheduled'
          }).returning('*');
          
          results.push(schedule);
        }
      }

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'batch_create_schedules',
        entity_type: 'schedule',
        changes: { count: results.length }
      });

      return results;
    });

    // Notify affected inspectors
    const inspectorIds = [...new Set(created.map(s => s.inspector_id))];
    inspectorIds.forEach(inspectorId => {
      emitToUser(inspectorId, 'schedule:batch_created', {
        count: created.filter(s => s.inspector_id === inspectorId).length
      });
    });

    res.status(201).json({
      created: created.length,
      schedules: created
    });
  } catch (error) {
    logger.error('Error batch creating schedules:', error);
    res.status(500).json({ error: error.message || 'Failed to create schedules' });
  }
});

// Update schedule
router.put('/:id', requirePrivilege('edit_schedule'), requireAgencyAccess, async (req, res) => {
  try {
    const updates = req.body;
    
    const updated = await db.transaction(async (trx) => {
      // Get existing schedule
      const existing = await trx('schedules')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .first();

      if (!existing) {
        throw new Error('Schedule not found');
      }

      // Check for conflicts if date/time changed
      if (updates.scheduled_date || updates.scheduled_time) {
        const conflicts = await trx('schedules')
          .where('inspector_id', updates.inspector_id || existing.inspector_id)
          .where('scheduled_date', updates.scheduled_date || existing.scheduled_date)
          .where('scheduled_time', updates.scheduled_time || existing.scheduled_time)
          .where('status', '!=', 'cancelled')
          .whereNot('id', req.params.id)
          .first();

        if (conflicts) {
          throw new Error('Schedule conflict');
        }
      }

      // Update schedule
      const [updated] = await trx('schedules')
        .where('id', req.params.id)
        .update({
          ...updates,
          updated_at: new Date()
        })
        .returning('*');

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'update_schedule',
        entity_type: 'schedule',
        entity_id: req.params.id,
        changes: { before: existing, after: updates }
      });

      return updated;
    });

    // Notify inspector if changed
    if (updated.inspector_id) {
      emitToUser(updated.inspector_id, 'schedule:updated', {
        scheduleId: updated.id,
        changes: updates,
        updatedBy: req.user.id
      });
    }

    res.json(updated);
  } catch (error) {
    logger.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message || 'Failed to update schedule' });
  }
});

// Update schedule status
router.patch('/:id/status', requireAgencyAccess, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [updated] = await db('schedules')
      .where('id', req.params.id)
      .where('agency_id', req.agencyId)
      .update({
        status,
        updated_at: new Date()
      })
      .returning('*');

    if (!updated) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Emit status change
    emitToAgency(req.agencyId, 'schedule:status_changed', {
      scheduleId: updated.id,
      status,
      changedBy: req.user.id
    });

    res.json(updated);
  } catch (error) {
    logger.error('Error updating schedule status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Cancel schedule
router.delete('/:id', requirePrivilege('cancel_schedule'), requireAgencyAccess, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.transaction(async (trx) => {
      const schedule = await trx('schedules')
        .where('id', req.params.id)
        .where('agency_id', req.agencyId)
        .first();

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Update status to cancelled
      await trx('schedules')
        .where('id', req.params.id)
        .update({
          status: 'cancelled',
          notes: reason || 'Cancelled by admin',
          updated_at: new Date()
        });

      // Add to audit trail
      await trx('audit_trails').insert({
        user_id: req.user.id,
        agency_id: req.agencyId,
        action: 'cancel_schedule',
        entity_type: 'schedule',
        entity_id: req.params.id,
        changes: { reason }
      });

      // Notify inspector
      if (schedule.inspector_id) {
        emitToUser(schedule.inspector_id, 'schedule:cancelled', {
          scheduleId: schedule.id,
          reason,
          cancelledBy: req.user.id
        });
      }
    });

    res.json({ message: 'Schedule cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling schedule:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel schedule' });
  }
});

// Get optimized route for day's schedules
router.get('/route/:date/:inspectorId', async (req, res) => {
  try {
    const { date, inspectorId } = req.params;

    // Verify inspector access
    if (inspectorId !== req.user.id && req.user.role !== 'manager' && 
        !req.user.privileges?.includes('view_all_schedules')) {
      return res.status(403).json({ error: 'Cannot view other inspector routes' });
    }

    // Get all schedules for the day
    const schedules = await db('schedules')
      .select(
        'schedules.*',
        'units.address',
        'units.city',
        'units.state',
        'units.zip_code'
      )
      .leftJoin('inspections', 'schedules.inspection_id', 'inspections.id')
      .leftJoin('units', 'inspections.unit_id', 'units.id')
      .where('schedules.inspector_id', inspectorId)
      .where('schedules.scheduled_date', date)
      .where('schedules.status', 'scheduled')
      .where('schedules.agency_id', req.agencyId)
      .orderBy('schedules.scheduled_time', 'asc');

    // Here you would integrate with Google Maps API to optimize route
    // For now, return schedules in time order
    const route = {
      date,
      inspectorId,
      totalStops: schedules.length,
      estimatedDuration: schedules.length * 45, // 45 minutes per inspection average
      schedules,
      optimized: false // Would be true after Google Maps optimization
    };

    res.json(route);
  } catch (error) {
    logger.error('Error generating route:', error);
    res.status(500).json({ error: 'Failed to generate route' });
  }
});

export default router;