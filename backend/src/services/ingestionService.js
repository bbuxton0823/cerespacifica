import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { securityService } from './securityService.js';
import { auditService } from './auditService.js';

export class IngestionService {
    
    /**
     * Helper to find value in row case-insensitively
     */
    getValue(row, keys) {
        if (!Array.isArray(keys)) keys = [keys];
        const rowKeys = Object.keys(row);
        
        for (const key of keys) {
            // 1. Exact match
            if (row[key] !== undefined) return row[key];
            
            // 2. Case-insensitive match
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const foundKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
        }
        return undefined;
    }

    /**
     * Parse Excel/CSV file and ingest data
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
                    // 1. Normalize Data & Parse Address
                    const rawAddress = this.getValue(row, ['Tenant Address', 'Address', 'Unit Address']);
                    
                    if (!rawAddress) {
                         // Skip rows without address but log error? Or just skip empty rows?
                         // Often CSVs have empty trailing rows.
                         continue; 
                    }

                    // Parse "102 Tiffany Drive Pittsburgh CA - 94565" format
                    let address = rawAddress;
                    let city = this.getValue(row, ['City', 'Town']) || '';
                    let state = this.getValue(row, ['State', 'St']) || 'CA';
                    let zip = this.getValue(row, ['Zip', 'Zip Code', 'Postal Code']) || '';

                    // Attempt to parse if single string
                    if (!city && !zip && rawAddress.includes(' - ')) {
                        const parts = rawAddress.split(' - ');
                        zip = parts[1].trim();
                        const addrParts = parts[0].trim().split(' ');
                        state = addrParts.pop(); // CA
                        city = addrParts.pop(); // Pittsburgh (Simple assumption, might need better logic for multi-word cities)
                        // Reconstruct city if it was multi-word? For now, simple split.
                        // Better approach: Use regex or just take the rest as address
                        address = addrParts.join(' ');
                        
                        // Refined Regex for "Street City State"
                        // This is tricky without a library, but we'll try a best effort split
                        // Assuming State is 2 chars at end
                        const mainPart = parts[0].trim();
                        const stateMatch = mainPart.match(/\s([A-Z]{2})$/);
                        if (stateMatch) {
                            state = stateMatch[1];
                            // Assume City is the last word(s) - Hard to distinguish Street from City without delimiter
                            // For this specific CSV format "Street City State", let's assume the user might provide City column or we accept the full string as address if parsing fails
                            // Actually, looking at the CSV "102 Tiffany Drive Pittsburgh CA", it seems space separated.
                            // We will store the FULL string as address if we can't split perfectly, but try to extract Zip.
                            address = mainPart; // Store full string "102 Tiffany Drive Pittsburgh CA" as address line 1 if we can't split perfectly
                        }
                    }

                    const unitData = {
                        address: address,
                        unit_number: this.getValue(row, ['Unit #', 'Unit No', 'Unit Code', 'Apt']) || '',
                        city: city,
                        zip_code: zip,
                        t_code: this.getValue(row, ['T-Code', 'TCode', 'Tenant Code']) || null,
                        tenant_name: securityService.encrypt(this.getValue(row, ['Tenant Name', 'Client Name', 'Tenant']) || ''),
                        tenant_phone: securityService.encrypt(this.getValue(row, ['Phone', 'Tenant Phone']) || ''),
                        landlord_name: securityService.encrypt(this.getValue(row, ['Owner Name', 'Landlord Name', 'Owner']) || ''),
                        landlord_address: this.getValue(row, ['Owner Address', 'Landlord Address']) || '',
                        property_info: this.getValue(row, ['Property Info', 'Property Code']) || '',
                        bedrooms: this.getValue(row, ['Number of Bedrooms', 'Bedrooms', 'Beds']) || 0,
                        agency_id: agencyId
                    };

                    // Mandatory Fields Check
                    // const required = ['tenant_name', 'landlord_name', 'landlord_address']; 
                    // Address checked above
                    // We skip strict checks to allow partial imports, but letters might fail generation if data missing.
                    
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

                        // Create or update inspection
                        // Note: The original instruction used 'nextDate' which was not defined.
                        // For new units, we'll use the explicit date from the row if available,
                        // otherwise, the compliance logic below will determine it.
                        const scheduledDateFromRow = this.getValue(row, ['Date of Inspection', 'Date', 'Inspection Date']);
                        let initialScheduledDate = null;
                        if (scheduledDateFromRow) {
                            if (typeof scheduledDateFromRow === 'number') {
                                initialScheduledDate = new Date((scheduledDateFromRow - (25567 + 2)) * 86400 * 1000);
                            } else {
                                initialScheduledDate = new Date(scheduledDateFromRow);
                            }
                        }

                        if (initialScheduledDate) {
                            const timeWindow = this.getValue(row, ['Window Time', 'Time', 'Time Window']) || '9:00 AM - 3:00 PM';
                            const inspType = this.getValue(row, ['Inspection Type', 'Type']) || 'Annual';

                            await trx('inspections').insert({
                                id: uuidv4(),
                                unit_id: unit.id,
                                agency_id: agencyId,
                                inspector_id: null, 
                                inspection_date: initialScheduledDate,
                                inspection_type: inspType,
                                status: 'pending',
                                data: JSON.stringify({ time_window: timeWindow }),
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                        }
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
                    const lastInspectionRaw = this.getValue(row, ['Last Inspection Date', 'Last Inspection']);

                    if (lastInspectionRaw) {
                        let lastDate;
                        if (typeof lastInspectionRaw === 'number') {
                            lastDate = new Date((lastInspectionRaw - (25567 + 2)) * 86400 * 1000);
                        } else {
                            lastDate = new Date(lastInspectionRaw);
                        }

                        // Determine Frequency (Default to Annual if not specified or T-Code logic)
                        const freq = this.getValue(row, ['Frequency']) || 'Annual';
                        const monthsToAdd = freq === 'Biennial' ? 24 : freq === 'Triennial' ? 36 : 12;

                        inspectionDate = new Date(lastDate);
                        inspectionDate.setMonth(inspectionDate.getMonth() + monthsToAdd);
                    } else {
                        // Fallback: If explicit date provided
                        const explicitDate = this.getValue(row, ['Inspection Date', 'Date']);
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
                            .where({ unit_id: unit.id, inspection_date: inspectionDate })
                            .first();

                        if (!existing) {
                            const timeWindow = this.getValue(row, ['Time', 'Time Window']) || '9:00 AM - 3:00 PM';
                            await trx('inspections').insert({
                                id: uuidv4(),
                                unit_id: unit.id,
                                agency_id: agencyId,
                                inspection_type: this.getValue(row, ['Type', 'Inspection Type']) || 'Annual',
                                status: 'pending',
                                inspection_date: inspectionDate,
                                data: JSON.stringify({ time_window: timeWindow }),
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
