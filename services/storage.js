import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import dotenv from 'dotenv'; dotenv.config();

const provider = process.env.STORAGE_PROVIDER || 'local';
const localDir = process.env.HLS_OUTPUT_DIR || 'storage/hls';

let s3 = null;
if (provider==='s3') {
  s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_KEY, secretAccessKey: process.env.S3_SECRET }
  });
}

export async function putFile(relPath, bufferOrPath) {
  if (provider==='local') {
    const full = path.join(localDir, relPath);
    await fs.promises.mkdir(path.dirname(full), { recursive:true });
    if (Buffer.isBuffer(bufferOrPath)) await fs.promises.writeFile(full, bufferOrPath);
    else await fs.promises.copyFile(bufferOrPath, full);
    return `/storage/hls/${relPath}`;
  } else {
    const Bucket = process.env.S3_BUCKET;
    const Key = relPath;
    const Body = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : await fs.promises.readFile(bufferOrPath);
    const ContentType = mime.lookup(relPath) || 'application/octet-stream';
    await s3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, ACL:'public-read' }));
    return `${process.env.S3_ENDPOINT}/${Bucket}/${Key}`;
  }
}
