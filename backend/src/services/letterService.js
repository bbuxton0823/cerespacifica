import { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, ImageRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { securityService } from './securityService.js';
import db from '../config/database.js';
import fs from 'fs';
import path from 'path';

export class LetterService {

    /**
   * Generate a Word Document Letter for an Inspection ID
   * @param {string} inspectionId
   * @param {string} type - 'standard' or 'final_notice'
   * @returns {Promise<Buffer>}
   */
    async generateLetterForInspection(inspectionId, type) {
        const inspection = await db('inspections')
            .join('units', 'inspections.unit_id', 'units.id')
            .join('agencies', 'inspections.agency_id', 'agencies.id')
            .where('inspections.id', inspectionId)
            .select(
                'inspections.*',
                'units.address',
                'units.city',
                'units.zip_code',
                'units.tenant_name',
                'units.landlord_name',
                'units.t_code',
                'agencies.name as agency_name',
                'agencies.settings as agency_settings'
            )
            .first();

        if (!inspection) throw new Error('Inspection not found');

        return this.generateLetter(type, inspection);
    }

    /**
     * Generate a Word Document Letter
     * @param {string} type - 'standard' or 'final_notice'
     * @param {object} data - Inspection and Agency data
     * @returns {Promise<Buffer>}
     */
    async generateLetter(type, data) {
        const doc = new Document({
            sections: [{
                properties: {},
                headers: {
                    default: new Header({
                        children: [
                            this.createSanMateoHeader()
                        ],
                    }),
                },
                children: type === 'final_notice'
                    ? this.createFinalNoticeBody(data)
                    : this.createStandardBody(data),
            }],
        });

        return await Packer.toBuffer(doc);
    }

    createSanMateoHeader() {
        // Simulating the header layout with a table
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "DOH", bold: true, size: 72, color: "8B0000" }), // Mock Logo text
                                    ]
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "DEPARTMENT OF HOUSING", bold: true, size: 16 }),
                                    ]
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "COUNTY OF SAN MATEO", size: 14 }),
                                    ]
                                }),
                            ],
                        }),
                        new TableCell({
                            width: { size: 40, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({ text: "Main Office - Department of Housing", bold: true, size: 16 }),
                                new Paragraph({ text: "264 Harbor Blvd., Building A, Belmont, CA 94002-4017", size: 14 }),
                                new Paragraph({ text: "" }),
                                new Paragraph({ text: "Housing Community Development", bold: true, size: 14 }),
                                new Paragraph({ text: "Tel: (650) 802-5050", size: 14 }),
                                new Paragraph({ text: "" }),
                                new Paragraph({ text: "Housing Authority of the County of San Mateo", bold: true, size: 14 }),
                                new Paragraph({ text: "Tel: (650) 802-3300", size: 14 }),
                            ],
                        }),
                        new TableCell({
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "Website:", bold: true }),
                                        new TextRun({ text: "\nwww.smchousing.org", color: "0000FF", underline: {} }),
                                    ],
                                    size: 14
                                }),
                                new Paragraph({ text: "" }),
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "E-mail:", bold: true }),
                                        new TextRun({ text: "\nhousing@smchousing.org", color: "0000FF", underline: {} }),
                                    ],
                                    size: 14
                                }),
                                new Paragraph({ text: "" }),
                                new Paragraph({ text: `t${data.t_code || '000000'}`, alignment: AlignmentType.RIGHT, size: 14 }),
                            ],
                        }),
                    ],
                }),
            ],
        });
    }

    createStandardBody(data) {
        const tenantName = securityService.decrypt(data.tenant_name);
        const address = data.address;
        const city = data.city;
        const zip = data.zip_code;
        const date = new Date(data.scheduled_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeWindow = data.time_window || "9:00 AM - 3:00 PM";

        return [
            new Paragraph({ text: "" }),
            new Paragraph({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: tenantName.toUpperCase() }),
            new Paragraph({ text: address.toUpperCase() }),
            new Paragraph({ text: `${city.toUpperCase()}, CA ${zip}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: `Dear ${tenantName.toUpperCase()}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Our agency has scheduled an inspection of your unit located at:" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: `${address.toUpperCase()}`, indent: { left: 720 } }), // Indent
            new Paragraph({ text: `${city.toUpperCase()}, CA ${zip}`, indent: { left: 720 } }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "The inspection has been scheduled as part of our Housing Quality Standards Inspection process." }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "The inspection will be conducted on " }),
                    new TextRun({ text: date, bold: true }),
                    new TextRun({ text: " between " }),
                    new TextRun({ text: timeWindow, bold: true }),
                    new TextRun({ text: "." }),
                ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Please take time before the inspection to ensure that all necessary repairs are made and that all smoke detectors are in place and working." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "If you have any questions concerning your inspection, please contact the Leasing Department at (650) 508-6769." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Sincerely," }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Nan McKay & Associates, Inc" }), // Or Agency Name
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "CC: WOODLAND PARK PROPERTY OWNER LLC" }), // Mock Owner
            new Paragraph({ text: "c/o WOODLAND PARK APTS" }),
            new Paragraph({ text: "5 NEWELL CT" }),
            new Paragraph({ text: "E PALO ALTO, CA 94303" }),
            // Barcode placeholder
            new Paragraph({
                children: [new TextRun({ text: "||||||||||||||||||||||||||||||||||||", font: "Code39" })],
                alignment: AlignmentType.CENTER
            }),
        ];
    }

    createFinalNoticeBody(data) {
        const tenantName = securityService.decrypt(data.tenant_name);
        const address = data.address;
        const city = data.city;
        const zip = data.zip_code;
        const newDate = new Date(data.scheduled_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const oldDate = new Date(new Date(data.scheduled_date).setDate(new Date(data.scheduled_date).getDate() - 14)).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }); // Mock old date
        const timeWindow = data.time_window || "9:00AM – 3:00PM";

        return [
            new Paragraph({ text: "" }),
            new Paragraph({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: tenantName.toUpperCase() }),
            new Paragraph({ text: address.toUpperCase() }),
            new Paragraph({ text: `${city.toUpperCase()}, CA ${zip}` }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [new TextRun({ text: "FINAL NOTICE", bold: true, highlight: "yellow" })],
                alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Subject: Annual Inspection" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Dear Participant:" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: `On ${oldDate}, we scheduled an Annual appointment for you.` }),
                ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "[X] You did not keep this appointment" }),
            new Paragraph({ text: "[ ] You have requested a rescheduling" }),
            new Paragraph({ text: "[ ] Other:" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Your new appointment has been scheduled for:" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: `Date: ${newDate}`, bold: true }),
                ],
                indent: { left: 720 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: `Time: ${timeWindow}`, bold: true }),
                ],
                indent: { left: 720 }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "If you cannot make this inspection appointment, please arrange to have someone else present on your behalf, who is 18 years of age or older. This appointment will not be rescheduled." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Failure to comply with this final inspection appointment is a violation of the Family Obligations under your Statement of Family Responsibility and may result in termination of your eligibility." }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Sincerely," }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Bycha Buxton" }),
            new Paragraph({ text: "Housing Inspector" }),
            new Paragraph({ text: "bbuxton@smchousing.org" }),
            new Paragraph({ text: "650-508-6769" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "cc: WOODLAND PARK PROPERTY OWNER LLC" }),
            new Paragraph({ text: "c/o WOODLAND PARK APTS" }),
            new Paragraph({ text: "5 NEWELL CT" }),
            new Paragraph({ text: "E PALO ALTO, CA 94303" }),
        ];
    }
}

export const letterService = new LetterService();
