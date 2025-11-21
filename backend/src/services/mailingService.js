import db from '../config/database.js';
import { logger } from '../utils/logger.js';

export class MailingService {
    /**
     * Merge data into a template
     * @param {string} template 
     * @param {object} data 
     */
    mergeTemplate(template, data) {
        return template.replace(/{{(\w+)}}/g, (match, key) => {
            return data[key] || '';
        });
    }

    /**
     * Generate letters for a batch of inspections
     * @param {string[]} inspectionIds 
     */
    async generateBatch(inspectionIds) {
        const inspections = await db('inspections')
            .join('units', 'inspections.unit_id', 'units.id')
            .join('agencies', 'inspections.agency_id', 'agencies.id')
            .whereIn('inspections.id', inspectionIds)
            .select('inspections.*', 'units.address', 'units.city', 'units.zip_code',
                'units.tenant_name', 'units.landlord_name', 'units.landlord_address',
                'agencies.name as agency_name', 'agencies.address as agency_address', 'agencies.phone as agency_phone');

        const generated = [];

        // Date for letter
        const dateToday = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Dynamic Templates
        const tenantTemplate = `
{{agency_name}}
{{agency_address}}

${dateToday}

{{tenant_name}}
{{address}}
{{city}}, {{zip_code}}

Dear {{tenant_name}}

Our agency has scheduled an inspection of your unit located at:

{{address}}
{{city}}, {{zip_code}}

The inspection has been scheduled as part of our Housing Quality Standards Inspection process.

The inspection will be conducted on {{scheduled_date}} between 9:00 AM and 3:00 PM.

Please take time before the inspection to ensure that all necessary repairs are made and that all smoke detectors are in place and working.

If you have any questions concerning your inspection, please contact us at {{agency_phone}}.

Sincerely,

{{agency_name}}


CC: {{landlord_name}}
{{landlord_address}}
`;

        const landlordTemplate = `
{{agency_name}}
{{agency_address}}

${dateToday}

{{landlord_name}}
{{landlord_address}}

Dear {{landlord_name}}

Our agency has scheduled an inspection of your property located at:

{{address}}
{{city}}, {{zip_code}}

Tenant: {{tenant_name}}

The inspection has been scheduled as part of our Housing Quality Standards Inspection process.

The inspection will be conducted on {{scheduled_date}} between 9:00 AM and 3:00 PM.

Please ensure access is available.

If you have any questions concerning your inspection, please contact us at {{agency_phone}}.

Sincerely,

{{agency_name}}
`;

        for (const insp of inspections) {
            const data = {
                ...insp,
                scheduled_date: new Date(insp.scheduled_date).toLocaleDateString()
            };

            // Generate Tenant Letter
            generated.push({
                type: 'Tenant Notice',
                recipient: insp.tenant_name,
                address: insp.address,
                content: this.mergeTemplate(tenantTemplate, data)
            });

            // Generate Landlord Letter
            generated.push({
                type: 'Landlord Notice',
                recipient: insp.landlord_name,
                address: insp.landlord_address,
                content: this.mergeTemplate(landlordTemplate, data)
            });
        }

        // In a real app, we would send these to a print API (Lob/Click2Mail) here.
        // For now, we return the generated content.
        return generated;
    }
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
