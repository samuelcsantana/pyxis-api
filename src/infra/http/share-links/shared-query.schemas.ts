import { z } from 'zod';
import { FEATURE_KINDS } from '../../../domain/queries/features';
import { FUNNEL_SEGMENT_DIMENSIONS } from '../../../domain/queries/funnel';
import {
  funnelFieldsSchema,
  funnelStepsSchema,
  goalIdSchema,
  rangeQuerySchema,
  reportFilterFields,
} from '../queries/query.schemas';
import type { ReportFilterName } from '../queries/report-filter-params';

export const FILTERS_NOT_SHARED = [
  'identity',
  'property',
] as const satisfies readonly ReportFilterName[];

const notShared = { identity: true, property: true } as const satisfies Record<
  (typeof FILTERS_NOT_SHARED)[number],
  true
>;

const sharedFilterFields = z.object(reportFilterFields).omit(notShared).shape;

export const sharedFilteredRangeQuerySchema = rangeQuerySchema.extend(sharedFilterFields);

export const sharedConversionRangeQuerySchema = rangeQuerySchema.extend({
  ...sharedFilterFields,
  goal: goalIdSchema.optional(),
});

export const sharedFeaturesQuerySchema = rangeQuerySchema.extend({
  kind: z.enum(FEATURE_KINDS),
  ...sharedFilterFields,
});

export const sharedFunnelQuerySchema = funnelFieldsSchema.omit(notShared);

export const sharedFunnelSegmentsQuerySchema = rangeQuerySchema.extend({
  steps: funnelStepsSchema,
  by: z.enum(FUNNEL_SEGMENT_DIMENSIONS),
  ...sharedFilterFields,
});

export type SharedFilteredRangeQuery = z.infer<typeof sharedFilteredRangeQuerySchema>;
export type SharedConversionRangeQuery = z.infer<typeof sharedConversionRangeQuerySchema>;
export type SharedFeaturesQuery = z.infer<typeof sharedFeaturesQuerySchema>;
export type SharedFunnelQuery = z.infer<typeof sharedFunnelQuerySchema>;
export type SharedFunnelSegmentsQuery = z.infer<typeof sharedFunnelSegmentsQuerySchema>;
