import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { securityService } from './securityService.js';
import fs from 'fs';
import path from 'path';

export class ReportService {
    /**
     * Generate HUD-52580 PDF for an inspection
     * @param {string} inspectionId 
     * @returns {Promise<Buffer>}
     */
    async generateHUD52580(inspectionId) {
        const inspection = await db('inspections')
            .join('units', 'inspections.unit_id', 'units.id')
            .join('agencies', 'inspections.agency_id', 'agencies.id')
            .where('inspections.id', inspectionId)
            .select('inspections.*', 'units.*', 'agencies.name as agency_name')
            .first();

        if (!inspection) throw new Error('Inspection not found');

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Header
            doc.fontSize(18).text('Inspection Checklist', { align: 'center' });
            doc.fontSize(12).text('Housing Choice Voucher Program', { align: 'center' });
            doc.moveDown();

            // Section 1: General Information
            doc.fontSize(14).text('1. General Information');
            doc.fontSize(10);
            doc.text(`Unit Address: ${inspection.address}, ${inspection.city}, ${inspection.zip_code}`);
            doc.text(`Tenant Name: ${securityService.decrypt(inspection.tenant_name)}`);
            doc.text(`Landlord Name: ${securityService.decrypt(inspection.landlord_name)}`);
            doc.text(`PHA: ${inspection.agency_name}`);
            doc.text(`Inspection Date: ${new Date(inspection.scheduled_date).toLocaleDateString()}`);
            doc.text(`Type: ${inspection.type}`);
            doc.moveDown();

            // Section 2: Inspection Results
            doc.fontSize(14).text('2. Inspection Summary');
            doc.fontSize(10);
            doc.text(`Status: ${inspection.status}`);
            doc.text(`Overall Result: ${inspection.result || 'Pending'}`);

            if (inspection.fail_items) {
                doc.moveDown();
                doc.fillColor('red').text('Fail Items:');
                const items = JSON.parse(inspection.fail_items || '[]');
                items.forEach((item, i) => {
                    doc.text(`${i + 1}. ${item.description} (${item.location}) - Comment: ${item.comment}`);
                });
                doc.fillColor('black');
            }
            doc.moveDown();

            // Section 3: Certification
            doc.fontSize(14).text('3. Certification');
            doc.fontSize(10);
            doc.text('I certify that I have inspected the above unit and found it to be in compliance/non-compliance with HQS.');
            doc.moveDown(2);
            doc.text('__________________________            __________________________');
            doc.text('Inspector Signature                                     Date');

            doc.end();
        });
    }

    /**
     * Generate Batch Export (CSV/Excel) for ingestion
     * @param {string[]} inspectionIds 
     * @returns {Buffer}
     */
    async generateBatchExport(inspectionIds) {
        const inspections = await db('inspections')
            .join('units', 'inspections.unit_id', 'units.id')
            .whereIn('inspections.id', inspectionIds)
            .select(
                'inspections.id',
                'units.t_code',
                'units.address',
                'units.unit_number',
                'units.city',
                'units.zip_code',
                'inspections.scheduled_date',
                'inspections.status',
                'inspections.result',
                'inspections.fail_items'
            );

        // Map to flat structure for CSV
        const data = inspections.map(insp => {
            const failItems = insp.fail_items ? JSON.parse(insp.fail_items) : [];
            const failComments = failItems.map(i => `${i.description}: ${i.comment}`).join('; ');

            return {
                'Inspection ID': insp.id,
                'T-Code': insp.t_code,
                'Address': insp.address,
                'Unit #': insp.unit_number,
                'City': insp.city,
                'Zip': insp.zip_code,
                'Date': new Date(insp.scheduled_date).toLocaleDateString(),
                'Status': insp.status,
                'Result': insp.result,
                'Fail Items': failComments // Detailed comments for PHA ingestion
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Inspections');

        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
}

export const reportService = new ReportService();
