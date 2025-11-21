import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { securityService } from './securityService.js';
import { auditService } from './auditService.js';

export class IngestionService {
    /**
     * Parse Excel file and ingest data
     * @param {Buffer} fileBuffer 
     * @param {string} agencyId 
     */
    async ingestSchedule(fileBuffer, agencyId) {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const results = {
            total: data.length,
            success: 0,
            errors: []
        };

        await db.transaction(async (trx) => {
            for (const row of data) {
                try {
                    // 1. Normalize Data
                    const unitData = {
                        address: row['Address'] || row['Unit Address'],
                        unit_number: row['Unit #'] || row['Unit No'] || '',
                        city: row['City'] || '',
                        zip_code: row['Zip'] || row['Zip Code'] || '',
                        t_code: row['T-Code'] || row['TCode'] || null,
                        tenant_name: securityService.encrypt(row['Tenant Name'] || row['Client Name'] || ''),
                        tenant_phone: securityService.encrypt(row['Phone'] || row['Tenant Phone'] || ''),
                        landlord_name: securityService.encrypt(row['Landlord Name'] || ''),
                        landlord_address: row['Landlord Address'] || '',
                        property_info: row['Property Info'] || row['Type'] || '',
                        agency_id: agencyId
                    };

                    if (!unitData.address) {
                        throw new Error('Missing Address');
                    }

                    // 2. Find or Create Unit
                    let unit = await trx('units')
                        .where({
                            address: unitData.address,
                            unit_number: unitData.unit_number,
                            agency_id: agencyId
                        })
                        .first();

                    if (!unit) {
                        const [newUnit] = await trx('units').insert({
                            id: uuidv4(),
                            ...unitData,
                            created_at: new Date(),
                            updated_at: new Date()
                        }).returning('*');
                        unit = newUnit;
                    } else {
                        // Update Unit Info
                        await trx('units')
                            .where({ id: unit.id })
                            .update({
                                ...unitData,
                                updated_at: new Date()
                            });
                    }

                    // 3. Compliance Logic: Calculate Next Inspection
                    let inspectionDate;
                    const lastInspectionRaw = row['Last Inspection Date'] || row['Last Inspection'];

                    if (lastInspectionRaw) {
                        let lastDate;
                        if (typeof lastInspectionRaw === 'number') {
                            lastDate = new Date((lastInspectionRaw - (25567 + 2)) * 86400 * 1000);
                        } else {
                            lastDate = new Date(lastInspectionRaw);
                        }

                        // Determine Frequency (Default to Annual if not specified or T-Code logic)
                        // Simple logic: If Biennial/Triennial specified in row, use that. Else Annual.
                        const freq = row['Frequency'] || 'Annual';
                        const monthsToAdd = freq === 'Biennial' ? 24 : freq === 'Triennial' ? 36 : 12;

                        inspectionDate = new Date(lastDate);
                        inspectionDate.setMonth(inspectionDate.getMonth() + monthsToAdd);
                    } else {
                        // Fallback: If explicit date provided
                        const explicitDate = row['Inspection Date'] || row['Date'];
                        if (explicitDate) {
                            if (typeof explicitDate === 'number') {
                                inspectionDate = new Date((explicitDate - (25567 + 2)) * 86400 * 1000);
                            } else {
                                inspectionDate = new Date(explicitDate);
                            }
                        }
                    }

                    if (inspectionDate) {
                        // Check if already scheduled
                        const existing = await trx('inspections')
                            .where({ unit_id: unit.id, scheduled_date: inspectionDate })
                            .first();

                        if (!existing) {
                            await trx('inspections').insert({
                                id: uuidv4(),
                                unit_id: unit.id,
                                agency_id: agencyId,
                                type: row['Type'] || 'Annual',
                                status: 'Scheduled',
                                scheduled_date: inspectionDate,
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                        }
                    }

                    results.success++;
                } catch (error) {
                    results.errors.push({ row, error: error.message });
                }
            }
        });

        return results;
    }
}

export default new IngestionService();
