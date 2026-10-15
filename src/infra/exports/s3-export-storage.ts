import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { ExportsUnavailableError } from '../../domain/errors/export.errors';
import type { ExportStorage } from '../../domain/services/export-storage';

const GZIP_CONTENT_TYPE = 'application/gzip';
const NOT_CONFIGURED = 'EXPORT_BUCKET is not set';

export async function gzipped(lines: AsyncIterable<string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await pipeline(Readable.from(lines), createGzip(), async (compressed: AsyncIterable<Buffer>) => {
    for await (const chunk of compressed) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks);
}

export class S3ExportStorage implements ExportStorage {
  constructor(
    private readonly bucket: string,
    private readonly client: S3Client,
  ) {}

  async writeCsv(key: string, fileName: string, lines: AsyncIterable<string>): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: await gzipped(lines),
        ContentType: GZIP_CONTENT_TYPE,
        ContentDisposition: `attachment; filename="${fileName}"`,
      }),
    );
  }

  downloadUrl(key: string, seconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: seconds,
    });
  }
}

export class UnconfiguredExportStorage implements ExportStorage {
  writeCsv(): Promise<void> {
    return Promise.reject(new ExportsUnavailableError(NOT_CONFIGURED));
  }

  downloadUrl(): Promise<string> {
    return Promise.reject(new ExportsUnavailableError(NOT_CONFIGURED));
  }
}

export function createExportStorage(
  bucket: string | undefined,
  client: () => S3Client = () => new S3Client({}),
): ExportStorage {
  return bucket === undefined
    ? new UnconfiguredExportStorage()
    : new S3ExportStorage(bucket, client());
}
