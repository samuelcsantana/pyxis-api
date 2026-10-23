import { z } from 'zod';
import type { ArrivalsReport, ArrivalTimes } from '../../../domain/queries/arrivals';
import { MAX_ARRIVAL_TIMES } from '../../../domain/queries/arrivals';

export const arrivalsQuerySchema = z.strictObject({
  from: z.iso.date().describe('First day, inclusive, in the project time zone'),
  to: z.iso.date().describe('Last day, inclusive, at most today in the project time zone'),
  since: z.iso
    .datetime({ offset: true })
    .describe('Count what arrived after this moment; earlier than 7 days ago counts from then'),
});

export type ArrivalsQueryParameters = z.infer<typeof arrivalsQuerySchema>;

const arrivalTimesSchema = z.strictObject({
  times: z
    .array(z.iso.datetime())
    .max(MAX_ARRIVAL_TIMES)
    .describe('When each one arrived, newest first, rounded up to the second'),
  more: z.boolean().describe(`Whether more than ${String(MAX_ARRIVAL_TIMES)} arrived`),
});

export const arrivalsReportSchema = z
  .strictObject({
    as_of: z.iso.datetime().describe('The moment of the answer, by the API clock'),
    active_visits: z
      .int()
      .min(0)
      .describe('Visits with any event received in the last 5 minutes, whatever the range'),
    visits: arrivalTimesSchema.describe('Visits that started: the first page view of each'),
    conversions: arrivalTimesSchema
      .nullable()
      .describe('The conversion event of the project; null when it has none'),
    named_events: arrivalTimesSchema.describe('Events with a name of the site'),
    failed_requests: arrivalTimesSchema.describe(
      'Requests of the site that failed, reads and writes',
    ),
  })
  .meta({
    id: 'ArrivalsReport',
    description:
      'What reached the project since a moment and happened inside the range of days, kind by ' +
      'kind. Only times and counts: no ids, names or paths.',
  });

export type ArrivalsReportBody = z.infer<typeof arrivalsReportSchema>;

function timesBody(arrived: ArrivalTimes) {
  return { times: arrived.times.map((time) => time.toISOString()), more: arrived.more };
}

export function arrivalsBody(report: ArrivalsReport): ArrivalsReportBody {
  return {
    as_of: report.asOf.toISOString(),
    active_visits: report.activeVisits,
    visits: timesBody(report.visits),
    conversions: report.conversions === null ? null : timesBody(report.conversions),
    named_events: timesBody(report.namedEvents),
    failed_requests: timesBody(report.failedRequests),
  };
}
