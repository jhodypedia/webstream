import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT }
}, {
  tableName: 'settings',
  timestamps: true,
});
