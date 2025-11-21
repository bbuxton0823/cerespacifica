/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.string('color').defaultTo('#3b82f6'); // Default Blue-500
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('color');
    });
}
