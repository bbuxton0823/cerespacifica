/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('inspections', 'time_window');
    if (!hasColumn) {
        await knex.schema.alterTable('inspections', function (table) {
            table.string('time_window').defaultTo('9:00 AM - 3:00 PM');
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('inspections', function (table) {
        table.dropColumn('time_window');
    });
}
