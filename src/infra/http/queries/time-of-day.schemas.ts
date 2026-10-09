import { z } from 'zod';
import { HOURS_IN_A_DAY, WEEKDAYS } from '../../../domain/queries/time-of-day';

export const timeOfDayReportSchema = z
  .strictObject({
    weekdays: z
      .array(
        z.strictObject({
          weekday: z.int().min(1).max(WEEKDAYS).describe('ISO weekday: 1 is Monday, 7 is Sunday'),
          hours: z
            .array(z.int())
            .length(HOURS_IN_A_DAY)
            .describe('Visits that started in each hour, 0 to 23, in the project time zone'),
        }),
      )
      .length(WEEKDAYS),
  })
  .meta({
    id: 'TimeOfDayReport',
    description:
      'When the visits of the range started: for each weekday, Monday first, and each local ' +
      'hour, the visits whose first page view happened then. The grid adds up to the visits.',
  });

export type TimeOfDayReportBody = z.infer<typeof timeOfDayReportSchema>;
