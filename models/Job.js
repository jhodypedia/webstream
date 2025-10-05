import { DataTypes } from 'sequelize';
import { sequelize } from './index.js';

export const Job = sequelize.define('Job', {
  id: { type:DataTypes.INTEGER, autoIncrement:true, primaryKey:true },
  video_id: DataTypes.STRING,
  type: DataTypes.STRING,
  status: { type:DataTypes.ENUM('queued','running','done','failed'), defaultValue:'queued' },
  progress: { type:DataTypes.INTEGER, defaultValue:0 },
  message: DataTypes.TEXT
});
