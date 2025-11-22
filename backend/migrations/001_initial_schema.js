export const up = async (knex) => {
  // Create agencies table
  await knex.schema.createTable('agencies', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('pha_code').unique();
    table.string('address');
    table.string('city');
    table.string('state');
    table.string('zip_code');
    table.string('phone');
    table.string('email');
    table.string('logo_url');
    table.json('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  // Create users table with RBAC
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.enum('role', ['inspector', 'admin', 'manager']).notNullable();
    table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
    table.json('privileges').defaultTo('[]');
    table.boolean('is_active').defaultTo(true);
    table.boolean('mfa_enabled').defaultTo(false);
    table.string('mfa_secret');
    table.timestamps(true, true);
    table.index(['agency_id', 'role']);
  });

  // Create units table
  await knex.schema.createTable('units', (table) => {
    table.uuid('id').primary();
    table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
    table.string('tenant_name').notNullable();
    table.string('tenant_id');
    table.string('address').notNullable();
    table.string('city').notNullable();
    table.string('state', 2).notNullable();
    table.string('zip_code', 10).notNullable();
    table.enum('unit_type', [
      'S/F Detached', 'Duplex/Triplex', 'Town House',
      'Apartment', 'Manufactured', 'SRO', 'Shared Housing', 'Other'
    ]).notNullable();
    table.integer('year_built');
    table.integer('bedrooms').notNullable();
    table.decimal('bathrooms', 3, 1).notNullable();
    table.string('external_system_id'); // ID from Yardi/Emphasys
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    table.index(['agency_id']);
    table.index(['tenant_id']);
  });

  // Create inspections table
  await knex.schema.createTable('inspections', (table) => {
    table.uuid('id').primary();
    table.uuid('unit_id').references('id').inTable('units').onDelete('CASCADE');
    table.uuid('inspector_id').references('id').inTable('users');
    table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
    table.enum('inspection_type', ['Initial', 'Annual', 'Reinspection', 'Special']).notNullable();
    table.enum('status', ['draft', 'pending', 'complete', 'cancelled']).defaultTo('draft');
    table.json('data').notNullable(); // Full InspectionData from cerespacifica
    table.timestamp('inspection_date').notNullable();
    table.timestamp('completed_at');
    table.text('signature_tenant');
    table.text('signature_owner');
    table.text('signature_inspector');
    table.string('t_code'); // HUD T-Code
    table.string('external_system_id'); // ID from Yardi/Emphasys
    table.string('import_batch_id'); // Track bulk uploads
    table.json('sync_metadata').defaultTo('{}');
    table.json('audit_log').defaultTo('[]');
    table.timestamps(true, true);
    table.index(['agency_id', 'status']);
    table.index(['unit_id']);
    table.index(['inspector_id']);
    table.index(['inspection_date']);
  });

  // Create schedules table
  await knex.schema.createTable('schedules', (table) => {
    table.uuid('id').primary();
    table.uuid('inspection_id').references('id').inTable('inspections').onDelete('CASCADE');
    table.uuid('inspector_id').references('id').inTable('users');
    table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
    table.date('scheduled_date').notNullable();
    table.time('scheduled_time');
    table.json('route').defaultTo('{}'); // Google Maps route data
    table.enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled']).defaultTo('scheduled');
    table.text('notes');
    table.timestamps(true, true);
    table.index(['inspector_id', 'scheduled_date']);
    table.index(['agency_id']);
  });

  // Create deficiencies table for normalized deficiency tracking
  await knex.schema.createTable('deficiencies', (table) => {
    table.uuid('id').primary();
    table.uuid('inspection_id').references('id').inTable('inspections').onDelete('CASCADE');
    table.string('item_id').notNullable(); // References item in inspection data
    table.string('section_id').notNullable();
    table.text('description').notNullable();
    table.enum('responsibility', ['owner', 'tenant']).notNullable();
    table.boolean('is_24hour').defaultTo(false);
    table.enum('status', ['open', 'resolved', 'verified']).defaultTo('open');
    table.json('photos'); // Array of photo URLs stored as JSON
    table.date('due_date');
    table.date('resolved_date');
    table.timestamps(true, true);
    table.index(['inspection_id']);
    table.index(['status']);
    table.index(['is_24hour']);
  });

  // Create reports table for generated reports
  await knex.schema.createTable('reports', (table) => {
    table.uuid('id').primary();
    table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
    table.uuid('generated_by').references('id').inTable('users');
    table.enum('type', ['SEMAP', 'PHAS', 'HUD', 'Custom']).notNullable();
    table.json('filters').defaultTo('{}');
    table.json('data').notNullable();
    table.string('file_url');
    table.timestamp('generated_at').notNullable();
    table.timestamps(true, true);
    table.index(['agency_id', 'type']);
    table.index(['generated_at']);
  });

  // Create audit_trails table
  await knex.schema.createTable('audit_trails', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').references('id').inTable('users');
    table.uuid('agency_id').references('id').inTable('agencies');
    table.string('action').notNullable();
    table.string('entity_type').notNullable();
    table.uuid('entity_id');
    table.json('changes').defaultTo('{}');
    table.string('ip_address');
    table.string('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['agency_id']);
    table.index(['entity_type', 'entity_id']);
    table.index(['created_at']);
  });

  // Create integration_logs table
  await knex.schema.createTable('integration_logs', (table) => {
    table.uuid('id').primary();
    table.uuid('agency_id').references('id').inTable('agencies');
    table.enum('service', ['HUD', 'EIV', 'PIC', 'QuickBooks', 'GoogleMaps']).notNullable();
    table.string('action').notNullable();
    table.json('request').defaultTo('{}');
    table.json('response').defaultTo('{}');
    table.integer('status_code');
    table.boolean('success').defaultTo(true);
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['agency_id', 'service']);
    table.index(['created_at']);
  });

  // Create sync_queue table for offline sync
  await knex.schema.createTable('sync_queue', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').references('id').inTable('users');
    table.uuid('agency_id').references('id').inTable('agencies');
    table.string('device_id').notNullable();
    table.json('changes').notNullable();
    table.timestamp('client_timestamp').notNullable();
    table.timestamp('server_timestamp').defaultTo(knex.fn.now());
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
    table.text('error_message');
    table.integer('retry_count').defaultTo(0);
    table.index(['user_id', 'device_id']);
    table.index(['status']);
    table.index(['server_timestamp']);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('sync_queue');
  await knex.schema.dropTableIfExists('integration_logs');
  await knex.schema.dropTableIfExists('audit_trails');
  await knex.schema.dropTableIfExists('reports');
  await knex.schema.dropTableIfExists('deficiencies');
  await knex.schema.dropTableIfExists('schedules');
  await knex.schema.dropTableIfExists('inspections');
  await knex.schema.dropTableIfExists('units');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('agencies');
};