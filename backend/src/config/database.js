import knex from 'knex';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'hqs_app'
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: '../migrations'
  }
});

export async function initDatabase() {
  try {
    // Test connection
    await db.raw('SELECT 1');
    logger.info('Database connection established');
    
    // Run migrations
    await db.migrate.latest();
    logger.info('Database migrations completed');
    
    return db;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

export default db;