import { Injectable, type PipeTransform } from '@nestjs/common';
import { InvalidBatchError } from '../errors/http-errors';
import { type BatchEnvelope, batchEnvelopeSchema } from './ingest.schemas';

@Injectable()
export class BatchEnvelopePipe implements PipeTransform<unknown, BatchEnvelope> {
  transform(value: unknown): BatchEnvelope {
    const result = batchEnvelopeSchema.safeParse(value);
    if (!result.success) {
      throw new InvalidBatchError();
    }
    return result.data;
  }
}
