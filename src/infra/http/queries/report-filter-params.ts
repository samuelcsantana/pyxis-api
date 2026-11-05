import { applyDecorators } from '@nestjs/common';
import { ApiQuery, type ApiQueryOptions } from '@nestjs/swagger';
import {
  BROWSER_FAMILIES,
  CHANNELS,
  DEVICE_TYPES,
  OS_FAMILIES,
} from '../../../domain/entities/tracked-event.entity';
import {
  MAX_REFERRER_HOST_LENGTH,
  MAX_UTM_VALUE_LENGTH,
} from '../../../domain/events/event-limits';
import { MAX_CITY_NAME_LENGTH } from '../../../domain/events/city';
import { conversionTarget, type Goal, goalWithId } from '../../../domain/goals/goal';
import { REGION_CODE_PATTERN } from '../../../domain/events/region';
import {
  MAX_VISIT_PATH_FILTERS,
  type ReportFilters,
  VISIT_IDENTITIES,
} from '../../../domain/queries/report-filters';
import type { RequestedRange } from '../../../usecases/queries/scoped-periods';
import type { ReportFilterParams } from './query.schemas';

interface FilteredRangeParams extends ReportFilterParams {
  readonly from: string;
  readonly to: string;
  readonly goal?: string;
}

const GOAL_ID_SCHEMA = { type: 'string', format: 'uuid' } as const;

export type ReportFilterName = keyof ReportFilterParams;

type ReportFilterQuery = ApiQueryOptions & { readonly name: ReportFilterName };

export function reportFiltersOf(query: ReportFilterParams, goals: readonly Goal[]): ReportFilters {
  return {
    paths: query.path ?? [],
    event:
      query.event === undefined ? null : { name: query.event, property: query.property ?? null },
    channel: query.channel ?? null,
    deviceType: query.device ?? null,
    browser: query.browser ?? null,
    os: query.os ?? null,
    identity: query.identity ?? null,
    country: query.country ?? null,
    region: query.region ?? null,
    city: query.city ?? null,
    source: query.source ?? null,
    campaign: query.campaign ?? null,
    failed: query.failed ?? false,
    reachedGoal:
      query.reached_goal === undefined ? null : goalWithId(goals, query.reached_goal).target,
  };
}

export function filteredRangeOf(
  query: FilteredRangeParams,
  goals: readonly Goal[],
): RequestedRange {
  return {
    from: query.from,
    to: query.to,
    filters: reportFiltersOf(query, goals),
    conversion: conversionTarget(goals, query.goal),
  };
}

export function ApiGoal() {
  return ApiQuery({
    name: 'goal',
    required: false,
    description:
      'The goal counted as conversions, by its id (GET /v1/projects/{projectId}/goals); without ' +
      'it, the first goal. Conversions are null when the project has no goal.',
    schema: GOAL_ID_SCHEMA,
  });
}

const REPORT_FILTER_QUERIES: readonly ReportFilterQuery[] = [
  {
    name: 'path',
    required: false,
    description:
      'Only the visits that viewed this page; a star matches any characters. Repeat it, up to ' +
      `${String(MAX_VISIT_PATH_FILTERS)} times, for the visits that viewed every one`,
    schema: { type: 'array', items: { type: 'string' }, maxItems: MAX_VISIT_PATH_FILTERS },
  },
  {
    name: 'event',
    required: false,
    description: 'Only the visits that sent this named event',
    schema: { type: 'string' },
  },
  {
    name: 'property',
    required: false,
    description: 'key=value: the event above carried this property value; needs event',
    schema: { type: 'string' },
  },
  {
    name: 'channel',
    required: false,
    description: 'Only the visits that came through this channel',
    enum: CHANNELS,
  },
  {
    name: 'device',
    required: false,
    description: 'Only the visits on this device type',
    enum: DEVICE_TYPES,
  },
  {
    name: 'browser',
    required: false,
    description: 'Only the visits in this browser family',
    enum: BROWSER_FAMILIES,
  },
  {
    name: 'os',
    required: false,
    description: 'Only the visits on this operating system family',
    enum: OS_FAMILIES,
  },
  {
    name: 'identity',
    required: false,
    description: 'identified: the visits that sent a user id; anonymous: those that never did',
    enum: VISIT_IDENTITIES,
  },
  {
    name: 'country',
    required: false,
    description: 'Only the visits from this two-letter country code',
    schema: { type: 'string', pattern: '^[A-Z]{2}$' },
  },
  {
    name: 'region',
    required: false,
    description:
      'Only the visits from this region: its ISO 3166-2 code, the country code, a hyphen and ' +
      'the subdivision',
    schema: { type: 'string', pattern: REGION_CODE_PATTERN.source },
  },
  {
    name: 'city',
    required: false,
    description:
      'Only the visits from this approximate city, by its exact name; send it with its region, ' +
      'since the same name exists in several regions',
    schema: { type: 'string', minLength: 1, maxLength: MAX_CITY_NAME_LENGTH },
  },
  {
    name: 'source',
    required: false,
    description:
      'Only the visits from this source as Acquisition names it: campaign source, referring ' +
      'host, (ad click) or (direct)',
    schema: { type: 'string', maxLength: MAX_REFERRER_HOST_LENGTH },
  },
  {
    name: 'campaign',
    required: false,
    description: 'Only the visits whose entry carried this campaign (utm_campaign)',
    schema: { type: 'string', maxLength: MAX_UTM_VALUE_LENGTH },
  },
  {
    name: 'failed',
    required: false,
    description: 'true: only the visits with a failed request (status 0 or 400 and above)',
    schema: { type: 'string', enum: ['true', 'false'] },
  },
  {
    name: 'reached_goal',
    required: false,
    description:
      'Only the visits that reached this goal, by its id: sent its event, or viewed a page its ' +
      'pattern matches',
    schema: GOAL_ID_SCHEMA,
  },
];

export function ApiReportFilters(...without: readonly ReportFilterName[]) {
  return applyDecorators(
    ...REPORT_FILTER_QUERIES.filter(({ name }) => !without.includes(name)).map((query) =>
      ApiQuery(query),
    ),
  );
}
