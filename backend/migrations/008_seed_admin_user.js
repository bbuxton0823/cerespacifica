/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const exists = await knex('users').where({ email: 'admin@smchousing.org' }).first();
    if (!exists) {
        await knex('users').insert({
            id: 'admin_user',
            agency_id: 'san_mateo_ha',
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@smchousing.org',
            password_hash: 'hashed_password_placeholder', // In real app, use bcrypt
            role: 'manager',
            is_active: true,
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
    await knex('users').where({ id: 'admin_user' }).del();
}
