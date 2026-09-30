import { Readable } from "node:stream";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "../env";
import { logger } from "./logger";
import { randomToken } from "./tokens";

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true, // MinIO
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

let bucketReady: Promise<void> | null = null;

function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      logger.info({ bucket: env.S3_BUCKET }, "bucket created");
    }
  })().catch((e) => {
    bucketReady = null;
    throw e;
  });
  return bucketReady;
}

/** Zdjęcie → WebP max 1200 px, bez metadanych EXIF (lokalizacja!). Zwraca klucz obiektu. */
export async function storeImage(prefix: string, input: Buffer): Promise<string> {
  const body = await sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await ensureBucket();
  const key = `${prefix}/${randomToken(16)}.webp`;
  await s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: "image/webp" }),
  );
  return key;
}

/** Plik bez przetwarzania (np. umowa PDF). */
export async function storeFile(prefix: string, body: Buffer, contentType: string, ext: string): Promise<string> {
  await ensureBucket();
  const key = `${prefix}/${randomToken(16)}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function readObject(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return { body: res.Body as Readable, contentType: res.ContentType ?? "application/octet-stream", length: res.ContentLength };
}

export async function deleteObject(key: string) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch (e) {
    logger.warn({ err: e, key }, "failed to delete object");
  }
}

export const mediaUrl = (key: string | null | undefined) => (key ? `/media/${key}` : null);
