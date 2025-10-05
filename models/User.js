import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true },
  password_hash: DataTypes.STRING,
  fullname: DataTypes.STRING,
  telegram_user_id: DataTypes.STRING,
}, {
  tableName: 'users',
  timestamps: true,
});
