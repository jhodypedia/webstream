import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Video = sequelize.define('Video', {
  id: { type: DataTypes.STRING, primaryKey: true },
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  slug: { type: DataTypes.STRING, unique: true },
  status: {
    type: DataTypes.ENUM('uploaded', 'processing', 'ready', 'failed', 'blocked'),
    defaultValue: 'uploaded',
  },
  storage_provider: DataTypes.STRING,
  hls_master_url: DataTypes.TEXT,
  duration_sec: DataTypes.INTEGER,
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  key_access: DataTypes.STRING,
  owner_user_id: DataTypes.INTEGER,
}, {
  tableName: 'videos',
  timestamps: true,
});
