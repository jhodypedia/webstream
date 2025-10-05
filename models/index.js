import { Sequelize } from 'sequelize';
import dotenv from 'dotenv'; dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  { host: process.env.DB_HOST, dialect:'mysql', logging:false }
);

export { User } from './User.js';
export { Video } from './Video.js';
export { VideoVariant } from './VideoVariant.js';
export { Job } from './Job.js';

// associations (optional minimal)
