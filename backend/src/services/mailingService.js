import db from '../config/database.js';
import { logger } from '../utils/logger.js';

export class MailingService {
    /**
     * Generate a notification for an inspection
     */
    async generateNotice(inspectionId, type) {
        try {
            const inspection = await db('inspections')
                .join('units', 'inspections.unit_id', 'units.id')
                .select('inspections.*', 'units.tenant_name', 'units.address', 'units.city', 'units.state', 'units.zip_code')
                .where('inspections.id', inspectionId)
                .first();

            if (!inspection) throw new Error('Inspection not found');

            let content = '';
            let recipient = 'Both'; // Default to both for most notices

            switch (type) {
                case 'Schedule_Notice':
                    content = `Dear ${inspection.tenant_name}, an inspection is scheduled for your unit at ${inspection.address} on ${new Date(inspection.inspection_date).toLocaleDateString()}.`;
                    break;
                case 'Failure_Notice':
                    content = `Notice of Failure: The unit at ${inspection.address} failed inspection on ${new Date(inspection.completed_at).toLocaleDateString()}. Repairs must be made by ${new Date(inspection.reinspection_deadline).toLocaleDateString()}.`;
                    break;
                case 'Reminder':
                    content = `Reminder: Inspection scheduled for ${new Date(inspection.inspection_date).toLocaleDateString()}.`;
                    break;
                default:
                    content = 'Notification';
            }

            const [notification] = await db('notifications')
                .insert({
                    inspection_id: inspectionId,
                    type,
                    recipient,
                    content,
                    status: 'Pending'
                })
                .returning('*');

            logger.info(`Generated ${type} notice for inspection ${inspectionId}`);
            return notification;
        } catch (error) {
            logger.error('Error generating notice:', error);
            throw error;
        }
    }

    /**
     * Send all pending notices (Mock implementation)
     */
    async sendPendingNotices() {
        const pending = await db('notifications').where({ status: 'Pending' });
        const results = { success: 0, failed: 0 };

        for (const notice of pending) {
            try {
                // Mock sending logic (e.g., call to SendGrid or Lob would go here)
                logger.info(`Sending notice ${notice.id} to ${notice.recipient}: ${notice.content}`);

                await db('notifications')
                    .where({ id: notice.id })
                    .update({
                        status: 'Sent',
                        sent_at: new Date()
                    });

                results.success++;
            } catch (error) {
                logger.error(`Failed to send notice ${notice.id}:`, error);
                await db('notifications')
                    .where({ id: notice.id })
                    .update({ status: 'Failed' });
                results.failed++;
            }
        }

        return results;
    }

    /**
     * Get notifications for an agency
     */
    async getNotifications(agencyId, filters = {}) {
        let query = db('notifications')
            .join('inspections', 'notifications.inspection_id', 'inspections.id')
            .where('inspections.agency_id', agencyId)
            .select('notifications.*', 'inspections.inspection_date', 'inspections.unit_id');

        if (filters.status) {
            query = query.where('notifications.status', filters.status);
        }

        return query.orderBy('notifications.created_at', 'desc');
    }
}

export const mailingService = new MailingService();
