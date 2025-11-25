import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { addDays, addYears, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export class SchedulingService {
    /**
     * Auto-route inspections to inspectors
     * @param {string} agencyId 
     * @param {Date} startDate 
     * @param {Date} endDate 
     */
    async autoRoute(agencyId, startDate, endDate) {
        // 1. Get unassigned scheduled inspections in range
        const inspections = await db('inspections')
            .join('units', 'inspections.unit_id', 'units.id')
            .where('inspections.agency_id', agencyId)
            .where('inspections.status', 'pending')
            .whereNull('inspections.inspector_id')
            .whereBetween('inspections.inspection_date', [startDate, endDate])
            .select('inspections.*', 'units.zip_code');

        // 2. Get Inspectors
        const inspectors = await db('users')
            .where({ agency_id: agencyId, role: 'Inspector' });

        if (inspectors.length === 0) return { error: 'No inspectors available' };

        // 3. Group by Date and Zip
        const grouped = inspections.reduce((acc, insp) => {
            const dateKey = new Date(insp.inspection_date).toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = {};

            const zip = insp.zip_code || 'UNKNOWN';
            if (!acc[dateKey][zip]) acc[dateKey][zip] = [];

            acc[dateKey][zip].push(insp);
            return acc;
        }, {});

        // 4. Assign (Simple Round Robin per Zip Cluster)
        let assignments = 0;
        let inspectorIdx = 0;

        await db.transaction(async (trx) => {
            for (const dateKey in grouped) {
                for (const zip in grouped[dateKey]) {
                    const cluster = grouped[dateKey][zip];
                    const inspector = inspectors[inspectorIdx % inspectors.length];

                    for (const insp of cluster) {
                        await trx('inspections')
                            .where({ id: insp.id })
                            .update({ inspector_id: inspector.id });
                        assignments++;
                    }
                    inspectorIdx++;
                }
            }
        });

        return { assignments, message: `Successfully assigned ${assignments} inspections.` };
    }
    /**
     * Schedule an inspection for a unit
     */
    async scheduleInspection(unitId, type, date, inspectorId, agencyId) {
        const trx = await db.transaction();
        try {
            // Create inspection record
            const [inspection] = await trx('inspections')
                .insert({
                    unit_id: unitId,
                    inspector_id: inspectorId,
                    agency_id: agencyId,
                    inspection_type: type,
                    status: 'draft',
                    inspection_date: date,
                    data: {} // Initialize with empty data
                })
                .returning('*');

            // Create schedule record
            await trx('schedules').insert({
                inspection_id: inspection.id,
                inspector_id: inspectorId,
                agency_id: agencyId,
                scheduled_date: date,
                status: 'scheduled'
            });

            await trx.commit();
            logger.info(`Scheduled ${type} inspection for unit ${unitId} on ${date}`);
            return inspection;
        } catch (error) {
            await trx.rollback();
            logger.error('Error scheduling inspection:', error);
            throw error;
        }
    }

    /**
     * Reschedule an inspection
     */
    async rescheduleInspection(inspectionId, newDate, reason) {
        const trx = await db.transaction();
        try {
            const inspection = await trx('inspections').where({ id: inspectionId }).first();
            if (!inspection) throw new Error('Inspection not found');

            // Check if new date is within compliance deadline if it's a re-inspection
            if (inspection.reinspection_deadline && new Date(newDate) > new Date(inspection.reinspection_deadline)) {
                logger.warn(`Rescheduling inspection ${inspectionId} past deadline ${inspection.reinspection_deadline}`);
                // In a real app, we might block this or require supervisor approval
            }

            // Update inspection date
            await trx('inspections')
                .where({ id: inspectionId })
                .update({ inspection_date: newDate });

            // Update schedule
            await trx('schedules')
                .where({ inspection_id: inspectionId })
                .update({
                    scheduled_date: newDate,
                    notes: reason ? db.raw("notes || ? ", [`\nRescheduled: ${reason}`]) : undefined
                });

            await trx.commit();
            logger.info(`Rescheduled inspection ${inspectionId} to ${newDate}`);
            return { success: true };
        } catch (error) {
            await trx.rollback();
            logger.error('Error rescheduling inspection:', error);
            throw error;
        }
    }

    /**
     * Process inspection result and update unit compliance
     */
    async processInspectionResult(inspectionId, result, deficiencies = []) {
        const trx = await db.transaction();
        try {
            const inspection = await trx('inspections').where({ id: inspectionId }).first();
            if (!inspection) throw new Error('Inspection not found');

            const now = new Date();

            if (result === 'No Entry') {
                // Update inspection status
                await trx('inspections')
                    .where({ id: inspectionId })
                    .update({
                        status: 'No Entry',
                        result: 'No Entry',
                        completed_at: now
                    });

                // Schedule re-inspection (e.g., in 14 days)
                const deadline = addDays(now, 14);
                await trx('inspections').insert({
                    id: uuidv4(), // Ensure uuid is imported if not already
                    unit_id: inspection.unit_id,
                    agency_id: inspection.agency_id,
                    type: inspection.type, // Keep same type
                    status: 'Scheduled',
                    scheduled_date: deadline,
                    created_at: now,
                    updated_at: now
                });

                logger.info(`Processed No Entry for ${inspectionId}. Rescheduled for ${deadline}`);
            } else if (result === 'Pass') {
                // Update unit to compliant
                await trx('units')
                    .where({ id: inspection.unit_id })
                    .update({
                        compliance_status: 'Compliant',
                        last_inspection_date: now
                    });

                // Complete inspection
                await trx('inspections')
                    .where({ id: inspectionId })
                    .update({
                        status: 'complete',
                        completed_at: now
                    });

            } else {
                // Failed inspection
                const deadline = addDays(now, 30);

                await trx('units')
                    .where({ id: inspection.unit_id })
                    .update({
                        compliance_status: 'Non-Compliant'
                    });

                await trx('inspections')
                    .where({ id: inspectionId })
                    .update({
                        status: 'complete',
                        completed_at: now
                    });

                // Schedule re-inspection placeholder
                // Ideally we'd ask the user to pick a date, but we set the deadline here
                // We can also create a 'Reinspection' inspection record immediately or wait for user action
                // For this implementation, we'll update the current inspection with the deadline for reference
                // and assume a separate flow triggers the actual scheduling of the re-inspection

                // Let's create the re-inspection record in 'pending' state
                const [reinspection] = await trx('inspections')
                    .insert({
                        unit_id: inspection.unit_id,
                        agency_id: inspection.agency_id,
                        inspection_type: 'Reinspection',
                        status: 'pending',
                        inspection_date: deadline, // Default to deadline, can be rescheduled
                        reinspection_deadline: deadline,
                        data: {}
                    })
                    .returning('*');

                logger.info(`Created re-inspection ${reinspection.id} due by ${deadline}`);
            }

            await trx.commit();
            return { success: true };
        } catch (error) {
            await trx.rollback();
            logger.error('Error processing inspection result:', error);
            throw error;
        }
    }

    /**
     * Find units due for inspection
     */
    async getUnitsDueForInspection(agencyId, daysThreshold = 30) {
        const units = await db('units')
            .where({ agency_id: agencyId })
            .andWhere(function () {
                this.whereNull('last_inspection_date')
                    .orWhereRaw(`
            CASE 
              WHEN inspection_frequency = 'Annual' THEN last_inspection_date + interval '1 year'
              WHEN inspection_frequency = 'Biennial' THEN last_inspection_date + interval '2 years'
              WHEN inspection_frequency = 'Triennial' THEN last_inspection_date + interval '3 years'
            END <= ?
          `, [addDays(new Date(), daysThreshold)]);
            });

        return units;
    }
}

export const schedulingService = new SchedulingService();
