export const up = async (knex) => {
    // Alter units table
    await knex.schema.alterTable('units', (table) => {
        table.enum('inspection_frequency', ['Annual', 'Biennial', 'Triennial']).defaultTo('Biennial');
        table.date('last_inspection_date');
        table.enum('compliance_status', ['Compliant', 'Non-Compliant', 'Abatement']).defaultTo('Compliant');
    });

    // Alter inspections table
    await knex.schema.alterTable('inspections', (table) => {
        table.date('reinspection_deadline');
    });

    // Create notifications table
    await knex.schema.createTable('notifications', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('inspection_id').references('id').inTable('inspections').onDelete('CASCADE');
        table.enum('type', ['Schedule_Notice', 'Failure_Notice', 'Reminder']).notNullable();
        table.string('recipient').notNullable(); // 'Tenant', 'Owner', 'Both'
        table.timestamp('sent_at');
        table.enum('status', ['Pending', 'Sent', 'Failed']).defaultTo('Pending');
        table.text('content');
        table.timestamps(true, true);
        table.index(['inspection_id']);
        table.index(['status']);
    });
};

export const down = async (knex) => {
    await knex.schema.dropTableIfExists('notifications');

    await knex.schema.alterTable('inspections', (table) => {
        table.dropColumn('reinspection_deadline');
    });

    await knex.schema.alterTable('units', (table) => {
        table.dropColumn('compliance_status');
        table.dropColumn('last_inspection_date');
        table.dropColumn('inspection_frequency');
    });
};
