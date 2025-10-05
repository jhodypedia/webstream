import { sequelize } from './db.js';
import { User } from './User.js';
import { Video } from './Video.js';
import { VideoVariant } from './VideoVariant.js';
import { Job } from './Job.js';

// 💡 Hubungan antar model
Video.hasMany(VideoVariant, { foreignKey: 'video_id', onDelete: 'CASCADE' });
VideoVariant.belongsTo(Video, { foreignKey: 'video_id' });

Video.hasMany(Job, { foreignKey: 'video_id', onDelete: 'CASCADE' });
Job.belongsTo(Video, { foreignKey: 'video_id' });

// Export semua instance
export { sequelize, User, Video, VideoVariant, Job };
