import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbName = process.env.DB_NAME || '';
const dbUser = process.env.DB_USER || '';
const dbPassword = process.env.DB_PASSWORD || '';

const sequelize = new Sequelize(
  dbName,
  dbUser,
  dbPassword,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    // Managed Postgres providers (Neon, Render, Supabase) require TLS —
    // set DB_SSL=true in their dashboards / .env.
    ...(process.env.DB_SSL === 'true' && {
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
    }),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;
