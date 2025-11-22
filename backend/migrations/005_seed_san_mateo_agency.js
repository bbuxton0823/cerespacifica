/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Check if agency exists
    const exists = await knex('agencies').where({ name: 'Housing Authority of the County of San Mateo' }).first();

    if (!exists) {
        await knex('agencies').insert({
            id: '11111111-1111-1111-1111-111111111111', // Fixed ID for testing
            name: 'Housing Authority of the County of San Mateo',
            address: '264 Harbor Blvd., Building A',
            city: 'Belmont',
            state: 'CA',
            zip_code: '94002',
            phone: '(650) 802-3300',
            email: 'housing@smchousing.org',
            logo_url: 'https://www.smchousing.org/logo.png', // Placeholder
            settings: JSON.stringify({
                letter_template: 'san_mateo_standard',
                final_notice_template: 'san_mateo_final'
            }),
            created_at: new Date(),
            updated_at: new Date()
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex('agencies').where({ id: '11111111-1111-1111-1111-111111111111' }).del();
}
