/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('units', 'bedrooms');
    if (!hasColumn) {
        await knex.schema.alterTable('units', function (table) {
            table.integer('bedrooms').defaultTo(0);
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('units', function (table) {
        table.dropColumn('bedrooms');
    });
}
