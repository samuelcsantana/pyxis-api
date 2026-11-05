import {
  FILTERS_NOT_SHARED,
  sharedConversionRangeQuerySchema,
  sharedFeaturesQuerySchema,
  sharedFilteredRangeQuerySchema,
  sharedFunnelQuerySchema,
  sharedFunnelSegmentsQuerySchema,
} from './shared-query.schemas';

const RANGE = { from: '2026-11-01', to: '2026-11-05' };
const STEPS = JSON.stringify([
  { type: 'page', path: '/pricing' },
  { type: 'event', name: 'purchase' },
]);
const SHARED_SCHEMAS = [
  ['filtered range', sharedFilteredRangeQuerySchema, RANGE],
  ['conversion range', sharedConversionRangeQuerySchema, RANGE],
  ['features', sharedFeaturesQuerySchema, { ...RANGE, kind: 'events' }],
  ['funnel', sharedFunnelQuerySchema, { ...RANGE, mode: 'visit', steps: STEPS }],
  ['funnel segments', sharedFunnelSegmentsQuerySchema, { ...RANGE, by: 'device', steps: STEPS }],
] as const;
const SHARED_FILTERS = {
  path: '/pricing',
  event: 'purchase',
  channel: 'direct',
  device: 'desktop',
  browser: 'chrome',
  os: 'macos',
  country: 'BR',
  region: 'BR-SP',
  city: 'Campinas',
  source: 'google',
  campaign: 'launch',
  failed: 'true',
  reached_goal: '7A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D',
};

describe('the query schemas of the shared reports', () => {
  it('leave out the filters that narrow to identified visits or to a property value', () => {
    expect(FILTERS_NOT_SHARED).toEqual(['identity', 'property']);
  });

  it.each(SHARED_SCHEMAS)('take every other dashboard filter for the %s', (_name, schema, base) => {
    expect(schema.parse({ ...base, ...SHARED_FILTERS })).toMatchObject({
      path: ['/pricing'],
      failed: true,
      reached_goal: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    });
  });

  it.each(
    SHARED_SCHEMAS.flatMap(([name, schema, base]) => [
      [name, 'identity', schema, { ...base, identity: 'identified' }],
      [name, 'property', schema, { ...base, event: 'purchase', property: 'order_id=42' }],
      [name, 'an unknown field', schema, { ...base, user_id: 'buyer-42' }],
    ]),
  )('refuse the %s with %s', (_name, _field, schema, query) => {
    expect(schema.safeParse(query).success).toBe(false);
  });

  it('take a goal on the reports that count conversions', () => {
    expect(
      sharedConversionRangeQuerySchema.parse({ ...RANGE, goal: SHARED_FILTERS.reached_goal }),
    ).toMatchObject({ goal: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' });
  });
});
