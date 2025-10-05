import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

// 🔗 Koneksi tunggal ke database
export const sequelize = new Sequelize(
  process.env.DB_NAME || 'streamdb',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    logging: false,
  }
);
