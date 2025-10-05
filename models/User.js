import { DataTypes } from 'sequelize';
import { sequelize } from './index.js';

export const User = sequelize.define('User', {
  id: { type:DataTypes.INTEGER, autoIncrement:true, primaryKey:true },
  email: DataTypes.STRING,
  password_hash: DataTypes.STRING,
  fullname: DataTypes.STRING,
  telegram_user_id: DataTypes.STRING
});
