// R2 Service — S3-compatible client for Cloudflare R2
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const {
  CF_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME = "ucs-media",
  R2_PUBLIC_URL = "", // e.g. https://cdn.ultimatecomputersoftware.com
} = process.env;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = R2_BUCKET_NAME;
const PUBLIC_URL = R2_PUBLIC_URL;

/**
 * Upload a file buffer to R2.
 * Returns the public URL (if configured) or a relative key for proxy serving.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const params: PutObjectCommandInput = {
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  await r2.send(new PutObjectCommand(params));

  const url = PUBLIC_URL
    ? `${PUBLIC_URL}/${key}`
    : key; // fallback: serve via /api/media/:key proxy

  return { key, url };
}

/**
 * Delete an object from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key }),
  );
}

/**
 * Generate a presigned URL for an object (useful for private/restricted access).
 */
export async function getSignedR2Url(
  key: string,
  expiresSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresSeconds },
  );
}

/**
 * Stream an object from R2 and return the body + content type.
 */
export async function getFromR2(
  key: string,
): Promise<{ body: Buffer; contentType?: string } | null> {
  try {
    const result = await r2.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    const body = await streamToBuffer(result.Body);
    return {
      body,
      contentType: result.ContentType,
    };
  } catch (err: any) {
    if (err.name === "NoSuchKey") return null;
    throw err;
  }
}

async function streamToBuffer(
  stream: any,
): Promise<Buffer> {
  if (stream instanceof Buffer) return stream;
  if (typeof stream?.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }
  // Fallback: collect chunks
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export { BUCKET, PUBLIC_URL };
