/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('units', (table) => {
        table.string('tenant_name');
        table.string('tenant_phone');
        table.string('landlord_name');
        table.string('landlord_address');
        table.string('landlord_email');
        table.string('property_info'); // e.g., "Single Family", "Apartment"
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('units', (table) => {
        table.dropColumn('tenant_name');
        table.dropColumn('tenant_phone');
        table.dropColumn('landlord_name');
        table.dropColumn('landlord_address');
        table.dropColumn('landlord_email');
        table.dropColumn('property_info');
    });
}
