import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { validateInspectionData } from '../utils/validators.js';
import { emitToAgency } from './socketService.js';

export class SyncService {
  /**
   * Process offline sync data from mobile app
   */
  async processSync(userId, agencyId, syncData) {
    const { deviceId, changes, clientTimestamp } = syncData;
    const results = [];
    const errors = [];

    try {
      // Start transaction
      await db.transaction(async (trx) => {
        // Record sync attempt
        const syncRecord = await trx('sync_queue').insert({
          user_id: userId,
          agency_id: agencyId,
          device_id: deviceId,
          changes: JSON.stringify(changes),
          client_timestamp: clientTimestamp,
          status: 'processing'
        }).returning('id');

        // Process each change
        for (const change of changes) {
          try {
            const result = await this.processChange(trx, userId, agencyId, change);
            results.push(result);
          } catch (error) {
            logger.error('Error processing change:', error);
            errors.push({
              changeId: change.id,
              error: error.message
            });
          }
        }

        // Update sync record
        await trx('sync_queue')
          .where('id', syncRecord[0].id)
          .update({
            status: errors.length > 0 ? 'failed' : 'completed',
            error_message: errors.length > 0 ? JSON.stringify(errors) : null
          });
      });

      // Emit real-time updates to agency users
      if (results.length > 0) {
        emitToAgency(agencyId, 'sync:completed', {
          deviceId,
          timestamp: new Date().toISOString(),
          changes: results.length
        });
      }

      return {
        success: true,
        processed: results.length,
        errors,
        serverTimestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Sync transaction failed:', error);
      throw error;
    }
  }

  /**
   * Process individual change from sync queue
   */
  async processChange(trx, userId, agencyId, change) {
    const { type, action, data, timestamp } = change;

    switch (type) {
      case 'inspection':
        return await this.syncInspection(trx, userId, agencyId, action, data, timestamp);
      case 'schedule':
        return await this.syncSchedule(trx, userId, agencyId, action, data, timestamp);
      case 'deficiency':
        return await this.syncDeficiency(trx, userId, agencyId, action, data, timestamp);
      default:
        throw new Error(`Unknown change type: ${type}`);
    }
  }

  /**
   * Sync inspection data
   */
  async syncInspection(trx, userId, agencyId, action, data, timestamp) {
    // Validate inspection data against HUD requirements
    const validation = await validateInspectionData(data);
    if (!validation.valid) {
      throw new Error(`Invalid inspection data: ${validation.errors.join(', ')}`);
    }

    let result;
    
      switch (action) {
        case 'create':
        result = await trx('inspections').insert({
          ...data,
          inspector_id: userId,
          agency_id: agencyId,
          created_at: timestamp,
          sync_metadata: {
            source: 'offline',
            synced_at: new Date().toISOString()
          }
        }).returning(['id', 'unit_id', 'status']);
        
        // Extract and save deficiencies
        await this.extractDeficiencies(trx, result[0].id, data.data);
        
        // Check for 24-hour emergency fails
        await this.check24HourFails(trx, result[0].id, data.data);
        break;

        case 'update': {
        // Check for conflicts
        const existing = await trx('inspections')
          .where('id', data.id)
          .where('agency_id', agencyId)
          .first();
        
        if (!existing) {
          throw new Error('Inspection not found');
        }

        // Last-write-wins conflict resolution
        if (new Date(existing.updated_at) > new Date(timestamp)) {
          logger.warn('Conflict detected - server version is newer');
          return {
            action: 'conflict',
            id: data.id,
            serverVersion: existing
          };
        }

        result = await trx('inspections')
          .where('id', data.id)
          .where('agency_id', agencyId)
          .update({
            ...data,
            updated_at: timestamp,
            sync_metadata: {
              ...existing.sync_metadata,
              last_sync: new Date().toISOString()
            }
          })
          .returning(['id', 'unit_id', 'status']);
        
        // Re-extract deficiencies
        await trx('deficiencies').where('inspection_id', data.id).delete();
        await this.extractDeficiencies(trx, data.id, data.data);
        
        // Re-check for 24-hour emergency fails
        await this.check24HourFails(trx, data.id, data.data);
        break;
        }

      case 'delete':
        result = await trx('inspections')
          .where('id', data.id)
          .where('agency_id', agencyId)
          .update({
            status: 'cancelled',
            updated_at: timestamp
          })
          .returning('id');
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Add to audit trail
    await trx('audit_trails').insert({
      user_id: userId,
      agency_id: agencyId,
      action: `sync:${action}:inspection`,
      entity_type: 'inspection',
      entity_id: result[0].id,
      changes: { timestamp, data }
    });

    return {
      type: 'inspection',
      action,
      id: result[0].id,
      status: 'synced'
    };
  }

  /**
   * Extract deficiencies from inspection data
   */
  async extractDeficiencies(trx, inspectionId, inspectionData) {
    const deficiencies = [];
    
    for (const section of inspectionData.sections) {
      for (const item of section.items) {
        if (item.status === 'FAIL') {
          deficiencies.push({
            inspection_id: inspectionId,
            item_id: item.id,
            section_id: section.id,
            description: `${item.label}: ${item.comment}`,
            responsibility: item.responsibility || 'owner',
            is_24hour: item.is24Hour || false,
            photos: item.photos || [],
            status: 'open',
            due_date: item.is24Hour 
              ? new Date(Date.now() + 24 * 60 * 60 * 1000) 
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          });
        }
      }
    }

    if (deficiencies.length > 0) {
      await trx('deficiencies').insert(deficiencies);
    }

    return deficiencies;
  }

  /**
   * Check for 24-hour emergency fails and trigger notifications
   */
  async check24HourFails(trx, inspectionId, inspectionData) {
    const emergencyFails = [];
    
    for (const section of inspectionData.sections) {
      for (const item of section.items) {
        if (item.status === 'FAIL' && item.is24Hour) {
          emergencyFails.push({
            inspectionId,
            item: item.label,
            section: section.title
          });
        }
      }
    }

    if (emergencyFails.length > 0) {
      // Queue notification job
      logger.warn(`24-hour emergency fails detected for inspection ${inspectionId}:`, emergencyFails);
      
      // This would trigger email/SMS notifications
      // await notificationService.send24HourAlert(inspectionId, emergencyFails);
    }

    return emergencyFails;
  }

  /**
   * Sync schedule changes
   */
  async syncSchedule(trx, userId, agencyId, action, data, timestamp) {
    let result;
    
    switch (action) {
      case 'create':
        result = await trx('schedules').insert({
          ...data,
          agency_id: agencyId,
          created_at: timestamp
        }).returning('id');
        break;

      case 'update':
        result = await trx('schedules')
          .where('id', data.id)
          .where('agency_id', agencyId)
          .update({
            ...data,
            updated_at: timestamp
          })
          .returning('id');
        break;

      case 'delete':
        result = await trx('schedules')
          .where('id', data.id)
          .where('agency_id', agencyId)
          .delete()
          .returning('id');
        break;
    }

    return {
      type: 'schedule',
      action,
      id: result[0].id,
      status: 'synced'
    };
  }

  /**
   * Sync deficiency updates
   */
  async syncDeficiency(trx, userId, agencyId, action, data, timestamp) {
    let result;
    
    switch (action) {
      case 'resolve':
        result = await trx('deficiencies')
          .where('id', data.id)
          .update({
            status: 'resolved',
            resolved_date: timestamp
          })
          .returning('id');
        break;

      case 'update':
        result = await trx('deficiencies')
          .where('id', data.id)
          .update({
            ...data,
            updated_at: timestamp
          })
          .returning('id');
        break;
    }

    return {
      type: 'deficiency',
      action,
      id: result[0].id,
      status: 'synced'
    };
  }

  /**
   * Get pending sync items for a device
   */
  async getPendingSync(deviceId, userId) {
    return await db('sync_queue')
      .where('device_id', deviceId)
      .where('user_id', userId)
      .where('status', 'pending')
      .orderBy('client_timestamp', 'asc');
  }

  /**
   * Clean up old sync records
   */
  async cleanupSyncQueue(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await db('sync_queue')
      .where('server_timestamp', '<', cutoffDate)
      .where('status', 'completed')
      .delete();

    logger.info(`Cleaned up ${deleted} old sync records`);
    return deleted;
  }
}

export default new SyncService();