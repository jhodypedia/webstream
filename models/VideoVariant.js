import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const VideoVariant = sequelize.define('VideoVariant', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  video_id: DataTypes.STRING,
  label: DataTypes.STRING,
  bandwidth: DataTypes.INTEGER,
  hls_url: DataTypes.TEXT,
}, {
  tableName: 'video_variants',
  timestamps: true,
});
