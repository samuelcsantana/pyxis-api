export const VISITOR_KINDS = [
  'first_visit',
  'first_this_month',
  'first_today',
  'again_today',
] as const;

export type VisitorKind = (typeof VISITOR_KINDS)[number];
