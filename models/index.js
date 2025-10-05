// 📁 models/index.js
import { sequelize } from './db.js';
import { User } from './User.js';
import { Video } from './Video.js';
import { VideoVariant } from './VideoVariant.js';
import { Job } from './Job.js';
import { Setting } from './Setting.js';

// 💡 Hubungan antar model
Video.hasMany(VideoVariant, { foreignKey: 'video_id', onDelete: 'CASCADE' });
VideoVariant.belongsTo(Video, { foreignKey: 'video_id' });

Video.hasMany(Job, { foreignKey: 'video_id', onDelete: 'CASCADE' });
Job.belongsTo(Video, { foreignKey: 'video_id' });

// 🧩 Hubungan video dan user (owner)
User.hasMany(Video, { foreignKey: 'owner_user_id', as: 'videos' });
Video.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });

// 🔧 Setting global (tidak punya relasi, 1 table key-value)
export {
  sequelize,
  User,
  Video,
  VideoVariant,
  Job,
  Setting
};
