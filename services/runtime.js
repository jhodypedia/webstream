export const runtimeConfig = {
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  TG_BOT_TOKEN: process.env.TG_BOT_TOKEN || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'ffmpeg',
};

export function reloadConfig(newConf = {}) {
  Object.assign(runtimeConfig, newConf);
  console.log('♻️ runtimeConfig reloaded:', Object.keys(newConf));
}
