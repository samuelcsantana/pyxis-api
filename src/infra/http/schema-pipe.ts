import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { InvalidRequestError } from './errors/http-errors';

export class SchemaPipe<Schema extends z.ZodType> implements PipeTransform<
  unknown,
  z.infer<Schema>
> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.infer<Schema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new InvalidRequestError();
    }
    return result.data;
  }
}
