import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { gunzipSync } from 'node:zlib';
import { ExportsUnavailableError } from '../../domain/errors/export.errors';
import {
  createExportDispatcher,
  DeferredExportDispatcher,
  LambdaExportDispatcher,
} from './lambda-export-dispatcher';
import {
  createExportStorage,
  gzipped,
  S3ExportStorage,
  UnconfiguredExportStorage,
} from './s3-export-storage';

const SIGNING_CLIENT = new S3Client({
  region: 'sa-east-1',
  credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'example-secret' },
});

async function* linesOf(...lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield await Promise.resolve(line);
  }
}

async function* failing(): AsyncGenerator<string> {
  yield await Promise.resolve('header\r\n');
  throw new Error('database went away');
}

function recordingS3() {
  const commands: PutObjectCommand[] = [];
  const client = {
    send: (command: PutObjectCommand) => {
      commands.push(command);
      return Promise.resolve({});
    },
  } as unknown as S3Client;
  return { client, commands };
}

describe('S3ExportStorage', () => {
  it('uploads the lines gzipped, as a file to download under its name', async () => {
    const { client, commands } = recordingS3();

    await new S3ExportStorage('exports-bucket', client).writeCsv(
      'exports/p/e.csv.gz',
      'pyxis-shop-2026-11-02.csv.gz',
      linesOf('a,b\r\n', '1,2\r\n'),
    );

    const input = commands[0]?.input;
    expect(input).toEqual(
      expect.objectContaining({
        Bucket: 'exports-bucket',
        Key: 'exports/p/e.csv.gz',
        ContentType: 'application/gzip',
        ContentDisposition: 'attachment; filename="pyxis-shop-2026-11-02.csv.gz"',
      }),
    );
    expect(gunzipSync(input?.Body as Buffer).toString('utf8')).toBe('a,b\r\n1,2\r\n');
  });

  it('fails the upload when the lines fail, so nothing half written is stored', async () => {
    const { client, commands } = recordingS3();

    await expect(
      new S3ExportStorage('exports-bucket', client).writeCsv('k', 'f', failing()),
    ).rejects.toThrow('database went away');
    expect(commands).toEqual([]);
  });

  it('signs a download link that lasts the seconds asked for', async () => {
    const url = await new S3ExportStorage('exports-bucket', SIGNING_CLIENT).downloadUrl(
      'exports/p/e.csv.gz',
      300,
    );

    expect(url).toContain('exports-bucket');
    expect(url).toContain('exports/p/e.csv.gz');
    expect(url).toContain('X-Amz-Expires=300');
  });

  it('is unavailable without a bucket', async () => {
    const storage = createExportStorage(undefined);

    expect(storage).toBeInstanceOf(UnconfiguredExportStorage);
    await expect(storage.writeCsv('k', 'f', linesOf())).rejects.toBeInstanceOf(
      ExportsUnavailableError,
    );
    await expect(storage.downloadUrl('k', 300)).rejects.toBeInstanceOf(ExportsUnavailableError);
  });

  it('uses S3 when a bucket is configured', () => {
    expect(createExportStorage('exports-bucket')).toBeInstanceOf(S3ExportStorage);
  });

  it('compresses nothing into an empty gzip file', async () => {
    expect(gunzipSync(await gzipped(linesOf())).toString('utf8')).toBe('');
  });
});

describe('the export dispatcher', () => {
  it('invokes the jobs function without waiting for it', async () => {
    const commands: InvokeCommand[] = [];
    const client = {
      send: (command: InvokeCommand) => {
        commands.push(command);
        return Promise.resolve({ StatusCode: 202 });
      },
    } as unknown as LambdaClient;

    await new LambdaExportDispatcher('pyxis-api-jobs', client).dispatch('export-1');

    expect(commands[0]?.input).toEqual(
      expect.objectContaining({ FunctionName: 'pyxis-api-jobs', InvocationType: 'Event' }),
    );
    expect(JSON.parse(Buffer.from(commands[0]?.input.Payload as Uint8Array).toString())).toEqual({
      job: 'export',
      exportId: 'export-1',
    });
  });

  it('leaves the export to the daily job when no jobs function is configured', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const dispatcher = createExportDispatcher(undefined);

    await dispatcher.dispatch('export-1');

    expect(dispatcher).toBeInstanceOf(DeferredExportDispatcher);
    expect(log).toHaveBeenCalledWith({
      message: 'exports.left_for_the_daily_job',
      exportId: 'export-1',
    });
    log.mockRestore();
  });

  it('invokes Lambda when a jobs function is configured', () => {
    expect(createExportDispatcher('pyxis-api-jobs')).toBeInstanceOf(LambdaExportDispatcher);
  });
});
