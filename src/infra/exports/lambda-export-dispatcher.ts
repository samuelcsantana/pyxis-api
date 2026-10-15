import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Logger } from '@nestjs/common';
import type { ExportDispatcher } from '../../domain/services/export-storage';

export const EXPORT_JOB = 'export';
const ASYNC_INVOCATION = 'Event';

export class LambdaExportDispatcher implements ExportDispatcher {
  constructor(
    private readonly functionName: string,
    private readonly client: LambdaClient,
  ) {}

  async dispatch(exportId: string): Promise<void> {
    await this.client.send(
      new InvokeCommand({
        FunctionName: this.functionName,
        InvocationType: ASYNC_INVOCATION,
        Payload: Buffer.from(JSON.stringify({ job: EXPORT_JOB, exportId })),
      }),
    );
  }
}

export class DeferredExportDispatcher implements ExportDispatcher {
  private readonly logger = new Logger('ExportDispatcher');

  dispatch(exportId: string): Promise<void> {
    this.logger.log({ message: 'exports.left_for_the_daily_job', exportId });
    return Promise.resolve();
  }
}

export function createExportDispatcher(
  functionName: string | undefined,
  client: () => LambdaClient = () => new LambdaClient({}),
): ExportDispatcher {
  return functionName === undefined
    ? new DeferredExportDispatcher()
    : new LambdaExportDispatcher(functionName, client());
}
