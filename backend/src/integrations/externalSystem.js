import Papa from 'papaparse';
import { logger } from '../utils/logger.js';
import db from '../config/database.js';

/**
 * Service to handle external system integrations (import/export)
 */
class ExternalSystemService {
    /**
     * Parse and import inspection data from CSV/JSON
     * @param {string} fileContent - Raw file content
     * @param {string} format - 'csv' or 'json'
     * @param {string} agencyId - Agency ID
     * @param {string} userId - User ID performing import
     */
    async importInspections(fileContent, format, agencyId, userId) {
        try {
            let data = [];

            if (format === 'csv') {
                const result = Papa.parse(fileContent, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_')
                });

                if (result.errors.length > 0) {
                    throw new Error(`CSV Parse Error: ${result.errors[0].message}`);
                }
                data = result.data;
            } else if (format === 'json') {
                data = JSON.parse(fileContent);
            } else {
                throw new Error('Unsupported format');
            }

            const batchId = `batch_${Date.now()}`;
            const results = {
                total: data.length,
                success: 0,
                failed: 0,
                errors: []
            };

            await db.transaction(async (trx) => {
                for (const row of data) {
                    try {
                        // 1. Map external data to internal schema
                        const unitData = this.mapUnitData(row);
                        const inspectionData = this.mapInspectionData(row);

                        // 2. Find or Create Unit
                        let unit = await trx('units')
                            .where('agency_id', agencyId)
                            .where(function () {
                                this.where('external_system_id', unitData.external_system_id)
                                    .orWhere('address', unitData.address);
                            })
                            .first();

                        if (!unit) {
                            [unit] = await trx('units').insert({
                                ...unitData,
                                agency_id: agencyId
                            }).returning('*');
                        } else {
                            // Update existing unit with new external ID if missing
                            if (!unit.external_system_id && unitData.external_system_id) {
                                await trx('units')
                                    .where('id', unit.id)
                                    .update({ external_system_id: unitData.external_system_id });
                            }
                        }

                        // 3. Create Inspection
                        const [inspection] = await trx('inspections').insert({
                            unit_id: unit.id,
                            agency_id: agencyId,
                            inspector_id: userId, // Assign to uploader initially, or parse from row
                            inspection_type: inspectionData.inspection_type || 'Initial',
                            status: 'pending',
                            t_code: inspectionData.t_code,
                            external_system_id: inspectionData.external_system_id,
                            import_batch_id: batchId,
                            inspection_date: inspectionData.inspection_date || new Date(),
                            data: JSON.stringify({ notes: inspectionData.notes || '' }),
                            created_at: new Date(),
                            updated_at: new Date()
                        }).returning('*');

                        // 4. Create Schedule (if time is provided)
                        if (inspectionData.scheduled_time) {
                            await trx('schedules').insert({
                                inspection_id: inspection.id,
                                inspector_id: userId,
                                agency_id: agencyId,
                                scheduled_date: inspectionData.inspection_date,
                                scheduled_time: inspectionData.scheduled_time,
                                notes: inspectionData.notes,
                                status: 'scheduled',
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                        }

                        results.success++;
                    } catch (err) {
                        results.failed++;
                        results.errors.push({
                            row: row,
                            error: err.message
                        });
                    }
                }

                // Log import
                await trx('audit_trails').insert({
                    user_id: userId,
                    agency_id: agencyId,
                    action: 'import_inspections',
                    entity_type: 'batch',
                    entity_id: batchId,
                    changes: {
                        count: results.total,
                        success: results.success,
                        failed: results.failed
                    }
                });
            });

            return results;
        } catch (error) {
            logger.error('Import failed:', error);
            throw error;
        }
    }

    /**
     * Import Schedule Data (Placeholder for future implementation)
     * @param {string} fileContent 
     * @param {string} format 
     */
    async importSchedule(fileContent, format) {
        // TODO: Implement schedule import logic once file format is provided
        logger.info('Schedule import not yet implemented');
        return { message: 'Schedule import coming soon' };
    }

    /**
   * Smart lookup for field values using aliases
   */
    findValue(row, aliases) {
        // 1. Try exact match
        for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
                return row[alias];
            }
        }

        // 2. Try case-insensitive match
        const keys = Object.keys(row);
        for (const alias of aliases) {
            const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (foundKey && row[foundKey]) return row[foundKey];
        }

        return null;
    }

    /**
   * Map raw row data to Unit schema using smart aliases
   */
    mapUnitData(row) {
        const ALIASES = {
            tenant_name: ['tenant_name', 'tenant', 'resident', 'name', 'head_of_household', 'tenant_name'],
            tenant_id: ['tenant_id', 'tenant_code', 'resident_id', 'entity_id', 't_id', 't_code'], // Added Tenant Code
            address: ['address', 'unit_address', 'street', 'street_address', 'location', 'mail_address'], // Added Mail Address
            city: ['city', 'town', 'municipality'],
            state: ['state', 'st', 'province'],
            zip_code: ['zip_code', 'zip', 'postal_code', 'postal'],
            unit_type: ['unit_type', 'type', 'building_type', 'structure'],
            bedrooms: ['bedrooms', 'br', 'bed', 'beds', 'bedroom_count', '#_bed'], // Added # Bed
            bathrooms: ['bathrooms', 'ba', 'bath', 'baths', 'bathroom_count'],
            year_built: ['year_built', 'year', 'built', 'construction_year', 'year(yyyy)_unit_built'], // Added Year(YYYY) Unit Built
            external_id: ['unit_id', 'external_id', 'property_id', 'prop_id', 'unit_code'] // Added Unit Code
        };

        return {
            tenant_name: this.findValue(row, ALIASES.tenant_name) || 'Unknown',
            tenant_id: this.findValue(row, ALIASES.tenant_id),
            address: this.findValue(row, ALIASES.address) || 'Unknown Address',
            city: this.findValue(row, ALIASES.city),
            state: this.findValue(row, ALIASES.state),
            zip_code: this.findValue(row, ALIASES.zip_code),
            unit_type: this.normalizeUnitType(this.findValue(row, ALIASES.unit_type)),
            bedrooms: parseInt(this.findValue(row, ALIASES.bedrooms) || 1),
            bathrooms: parseFloat(this.findValue(row, ALIASES.bathrooms) || 1),
            year_built: parseInt(this.findValue(row, ALIASES.year_built) || 1980),
            external_system_id: this.findValue(row, ALIASES.external_id)
        };
    }

    /**
     * Map raw row data to Inspection schema using smart aliases
     */
    mapInspectionData(row) {
        const ALIASES = {
            t_code: ['t_code', 'tcode', 'ticket', 'ticket_number', 'control_number', 'inspection_id'], // Inspection ID often acts as T-Code
            external_id: ['inspection_id', 'external_inspection_id', 'insp_id', 'work_order'],
            type: ['inspection_type', 'type', 'reason', 'purpose'],
            date: ['inspection_date', 'date', 'scheduled_date', 'due_date', 'scheduled_date/time'], // Added Scheduled Date/Time
            notes: ['notes', 'scheduled_notes', 'comments', 'instructions'] // Added Scheduled Notes
        };

        const dateStr = this.findValue(row, ALIASES.date);
        let date = new Date();
        let time = null;

        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                date = d;
                // Extract time if present (HH:MM)
                const timeMatch = dateStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
                if (timeMatch) time = timeMatch[0];
            }
        }

        return {
            t_code: this.findValue(row, ALIASES.t_code),
            external_system_id: this.findValue(row, ALIASES.external_id),
            inspection_type: this.normalizeInspectionType(this.findValue(row, ALIASES.type)),
            inspection_date: date,
            scheduled_time: time,
            notes: this.findValue(row, ALIASES.notes)
        };
    }

    normalizeUnitType(type) {
        const map = {
            'sf': 'S/F Detached',
            'apt': 'Apartment',
            'row': 'Town House',
            'mh': 'Manufactured'
        };
        return map[type?.toLowerCase()] || 'S/F Detached';
    }

    normalizeInspectionType(type) {
        const map = {
            'annual': 'Annual',
            'initial': 'Initial',
            'special': 'Special',
            'reinspection': 'Reinspection'
        };
        return map[type?.toLowerCase()] || 'Initial';
    }

    /**
     * Export completed inspections to CSV
     */
    async exportInspections(agencyId, filters = {}) {
        const inspections = await db('inspections')
            .select(
                'inspections.id',
                'inspections.t_code',
                'inspections.external_system_id',
                'inspections.status',
                'inspections.inspection_date',
                'inspections.completed_at',
                'units.address',
                'units.tenant_name',
                'units.tenant_id',
                'users.first_name as inspector_first',
                'users.last_name as inspector_last'
            )
            .leftJoin('units', 'inspections.unit_id', 'units.id')
            .leftJoin('users', 'inspections.inspector_id', 'users.id')
            .where('inspections.agency_id', agencyId)
            .modify(qb => {
                if (filters.status) qb.where('inspections.status', filters.status);
                if (filters.batchId) qb.where('inspections.import_batch_id', filters.batchId);
                if (filters.dateFrom) qb.where('inspections.completed_at', '>=', filters.dateFrom);
            });

        return Papa.unparse(inspections);
    }
}

export default new ExternalSystemService();
