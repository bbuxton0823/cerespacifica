const inspectorPasswordHash = '$2b$10$3ZeJtzclSq1F/McrFYrr1.rCOv58/QWcytnc3ngVGpiU7qwAQv.XC';

const AGENCY_ID = '00000000-0000-4000-8000-000000000001';
const INSPECTOR_ID = '00000000-0000-4000-8000-000000000101';
const UNIT_ID = '00000000-0000-4000-8000-000000000201';
const INSPECTION_ID = '00000000-0000-4000-8000-000000000301';
const SCHEDULE_ID = '00000000-0000-4000-8000-000000000401';

export const seed = async (knex) => {
  await knex.transaction(async trx => {
    await trx('schedules').where('id', SCHEDULE_ID).del();
    await trx('inspections').where('id', INSPECTION_ID).del();
    await trx('units').where('id', UNIT_ID).del();
    await trx('users').where('id', INSPECTOR_ID).del();
    await trx('agencies').where('id', AGENCY_ID).del();

    await trx('agencies').insert({
      id: AGENCY_ID,
      name: 'Housing Authority of the County of San Mateo',
      pha_code: 'SMC-001',
      config: {
        timezone: 'America/Los_Angeles',
        default_inspection_window: '9AM-3PM'
      }
    });

    await trx('users').insert({
      id: INSPECTOR_ID,
      email: 'adam.kruse-inspector@demo.hqs',
      password_hash: inspectorPasswordHash,
      first_name: 'Adam',
      last_name: 'Kruse',
      role: 'inspector',
      agency_id: AGENCY_ID,
      privileges: ['create_inspection', 'edit_inspection', 'complete_inspection', 'view_all_schedules']
    });

    await trx('units').insert({
      id: UNIT_ID,
      agency_id: AGENCY_ID,
      tenant_name: 'Adam Kruse',
      tenant_id: 't0036404',
      address: '355 E O\'Keefe St #26',
      city: 'East Palo Alto',
      state: 'CA',
      zip_code: '94303',
      unit_type: 'Apartment',
      year_built: 1988,
      bedrooms: 2,
      bathrooms: 1,
      metadata: {
        owner: 'Woodland Park Property Owner LLC',
        cc_address: 'Woodland Park Apts 5 Newell Ct, East Palo Alto, CA 94303'
      }
    });

    await trx('inspections').insert({
      id: INSPECTION_ID,
      unit_id: UNIT_ID,
      inspector_id: INSPECTOR_ID,
      agency_id: AGENCY_ID,
      inspection_type: 'Initial',
      status: 'pending',
      data: {
        tenant: 'Adam Kruse',
        letter_reference: 'Notice dated 09/30/2025',
        special_instructions: 'Ensure all smoke detectors operational'
      },
      inspection_date: new Date('2025-10-23T09:00:00-07:00'),
      t_code: 't0036404'
    });

    await trx('schedules').insert({
      id: SCHEDULE_ID,
      inspection_id: INSPECTION_ID,
      inspector_id: INSPECTOR_ID,
      agency_id: AGENCY_ID,
      scheduled_date: '2025-10-23',
      scheduled_time: '09:00:00',
      status: 'scheduled',
      notes: 'Window provided in tenant letter: 9AM-3PM',
      route: {
        origin: '264 Harbor Blvd, Belmont, CA 94002',
        stops: [
          {
            label: '355 E O\'Keefe St #26, East Palo Alto, CA 94303',
            eta_window: '09:00-15:00'
          }
        ]
      }
    });
  });
};
