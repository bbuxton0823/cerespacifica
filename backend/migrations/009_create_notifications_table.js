/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('notifications', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('inspection_id').references('id').inTable('inspections').onDelete('CASCADE');
        table.string('type').notNullable(); // Schedule_Notice, Failure_Notice, etc.
        table.string('recipient').notNullable(); // Tenant, Landlord, Both
        table.text('content').notNullable();
        table.string('status').defaultTo('Pending'); // Pending, Sent, Failed
        table.timestamp('sent_at');
        table.timestamps(true, true);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('notifications');
}
