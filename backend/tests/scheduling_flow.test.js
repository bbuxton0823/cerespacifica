import { schedulingService } from '../src/services/schedulingService.js';
import { mailingService } from '../src/services/mailingService.js';
import db from '../src/config/database.js';
import { addDays } from 'date-fns';

async function runTest() {
    console.log('Starting Scheduling & Mailing Flow Test...');

    try {
        // 1. Setup: Create Agency, User, Unit
        console.log('Setting up test data...');
        const [agency] = await db('agencies').insert({ name: 'Test Agency', pha_code: 'TEST001' }).returning('*');
        const [user] = await db('users').insert({
            email: 'inspector@test.com',
            password_hash: 'hash',
            first_name: 'Test',
            last_name: 'Inspector',
            role: 'inspector',
            agency_id: agency.id
        }).returning('*');

        const [unit] = await db('units').insert({
            agency_id: agency.id,
            tenant_name: 'John Doe',
            address: '123 Test St',
            city: 'Test City',
            state: 'CA',
            zip_code: '90000',
            unit_type: 'Apartment',
            bedrooms: 2,
            bathrooms: 1,
            inspection_frequency: 'Biennial'
        }).returning('*');

        // 2. Schedule Inspection
        console.log('Testing Schedule Inspection...');
        const scheduledDate = addDays(new Date(), 7);
        const inspection = await schedulingService.scheduleInspection(
            unit.id,
            'Annual',
            scheduledDate,
            user.id,
            agency.id
        );
        console.log('Inspection scheduled:', inspection.id);

        // 3. Reschedule Inspection
        console.log('Testing Reschedule Inspection...');
        const newDate = addDays(new Date(), 14);
        await schedulingService.rescheduleInspection(inspection.id, newDate, 'Tenant request');

        const updatedSchedule = await db('schedules').where({ inspection_id: inspection.id }).first();
        if (new Date(updatedSchedule.scheduled_date).getTime() !== newDate.getTime()) {
            throw new Error('Reschedule failed: Date mismatch');
        }
        console.log('Reschedule successful');

        // 4. Process Result (Fail) -> Verify Re-inspection & Notice
        console.log('Testing Inspection Failure & Re-inspection...');
        await schedulingService.processInspectionResult(inspection.id, false, []);

        // Check unit status
        const updatedUnit = await db('units').where({ id: unit.id }).first();
        if (updatedUnit.compliance_status !== 'Non-Compliant') {
            throw new Error('Unit status update failed');
        }

        // Check re-inspection created
        const reinspection = await db('inspections')
            .where({ unit_id: unit.id, inspection_type: 'Reinspection' })
            .first();

        if (!reinspection) {
            throw new Error('Re-inspection not created');
        }
        console.log('Re-inspection created:', reinspection.id);

        // Generate Notice
        await mailingService.generateNotice(inspection.id, 'Failure_Notice');

        const notice = await db('notifications')
            .where({ inspection_id: inspection.id, type: 'Failure_Notice' })
            .first();

        if (!notice) {
            throw new Error('Failure notice not generated');
        }
        console.log('Failure notice generated:', notice.id);

        // 5. Cleanup
        console.log('Cleaning up...');
        await db('notifications').del();
        await db('schedules').del();
        await db('inspections').del();
        await db('units').del();
        await db('users').del();
        await db('agencies').del();

        console.log('TEST PASSED SUCCESSFULLY');
        process.exit(0);
    } catch (error) {
        console.error('TEST FAILED:', error);
        process.exit(1);
    }
}

runTest();
