import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { runtimeConfig } from './runtime.js'; // ambil config live
dotenv.config();

let s3 = null;

/** Helper untuk re-init S3 saat config berubah */
function getS3() {
  if (runtimeConfig.STORAGE_PROVIDER !== 's3') return null;
  if (!s3) {
    s3 = new S3Client({
      region: runtimeConfig.S3_REGION || 'auto',
      endpoint: runtimeConfig.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: runtimeConfig.S3_ACCESS_KEY,
        secretAccessKey: runtimeConfig.S3_SECRET_KEY,
      },
    });
  }
  return s3;
}

/**
 * Upload file ke local / S3 sesuai setting
 * @param {string} relPath - path relatif tujuan (ex: videoId/720p.m3u8)
 * @param {Buffer|string} bufferOrPath - isi buffer atau path file lokal
 */
export async function putFile(relPath, bufferOrPath) {
  const provider = runtimeConfig.STORAGE_PROVIDER || 'local';
  const localDir = process.env.HLS_OUTPUT_DIR || 'storage/hls';

  if (provider === 'local') {
    const full = path.join(localDir, relPath);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(bufferOrPath)) {
      await fs.promises.writeFile(full, bufferOrPath);
    } else {
      await fs.promises.copyFile(bufferOrPath, full);
    }
    return `/storage/hls/${relPath}`;
  }

  // === S3 upload ===
  const s3Client = getS3();
  if (!s3Client) throw new Error('S3 client not initialized');

  const Bucket = runtimeConfig.S3_BUCKET;
  const Key = relPath;
  const Body = Buffer.isBuffer(bufferOrPath)
    ? bufferOrPath
    : await fs.promises.readFile(bufferOrPath);
  const ContentType = mime.lookup(relPath) || 'application/octet-stream';

  await s3Client.send(
    new PutObjectCommand({
      Bucket,
      Key,
      Body,
      ContentType,
      ACL: 'public-read',
    })
  );

  return `${runtimeConfig.S3_ENDPOINT}/${Bucket}/${Key}`;
}
