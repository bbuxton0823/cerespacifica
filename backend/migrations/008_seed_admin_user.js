/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const exists = await knex('users').where({ email: 'admin@smchousing.org' }).first();
    if (!exists) {
        await knex('users').insert({
            id: '22222222-2222-2222-2222-222222222222',
            agency_id: '11111111-1111-1111-1111-111111111111',
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
    await knex('users').where({ id: '22222222-2222-2222-2222-222222222222' }).del();
}
