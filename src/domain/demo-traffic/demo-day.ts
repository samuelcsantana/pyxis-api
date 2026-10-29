import type { Attribution, PropertyMap, TrackedEvent } from '../entities/tracked-event.entity';
import { classifyChannel } from '../events/channel';
import { API_REQUEST, PAGE_VIEW } from '../events/reserved-event-names';
import { isoWeekday } from '../queries/date-range';
import {
  DEMO_BLOG_PATHS,
  DEMO_CART_OUTCOMES,
  DEMO_CATEGORIES,
  DEMO_CONVERSION_EVENT,
  DEMO_DAILY_VARIATION,
  DEMO_DEVICES,
  DEMO_FAILED_READ_CHANCE,
  DEMO_FAILED_READS,
  DEMO_LOYAL_PEOPLE,
  DEMO_ORDER_OUTCOMES,
  DEMO_ORDER_RETRY_CHANCE,
  DEMO_PAYMENT_METHODS,
  DEMO_PEOPLE,
  DEMO_PLACES,
  DEMO_PLANS,
  DEMO_PRICING_EXIT_CHANCE,
  DEMO_SIGN_UP_PAGE_EXIT_CHANCE,
  type DemoDevice,
  type DemoPlace,
  type DemoRequestOutcome,
  DEMO_SEARCH_CHANCE,
  DEMO_SIGN_IN_OUTCOMES,
  DEMO_SIGN_UP_OUTCOMES,
  DEMO_SOURCES,
  DEMO_VISITS_BY_HOUR,
  DEMO_VISITS_BY_WEEKDAY,
  demoCityOf,
} from './demo-store';
import { type SeededRandom, seededRandom, type Weighted } from './seeded-random';
import { instantInZone } from './zoned-time';

const MILLISECONDS_PER_SECOND = 1000;
const MINUTES_PER_HOUR = 60;
const SHORTEST_PAUSE_SECONDS = 4;
const LONGEST_PAUSE_SECONDS = 90;
const FASTEST_DELIVERY_MS = 800;
const SLOWEST_DELIVERY_MS = 4000;
const FASTEST_REQUEST_MS = 60;
const SLOWEST_REQUEST_MS = 900;
const FAILED_REQUEST_EXTRA_MS = 400;
const LOYAL_VISIT_CHANCE = 0.6;
const PERSON_ID_LENGTH = 8;
const PERSON_ID_LETTERS = 'abcdefghjkmnpqrstuvwxyz';
const SUCCESS_STATUS_LIMIT = 400;

type Journey = 'bounce' | 'browse' | 'cart' | 'purchase' | 'sign-up' | 'returning';

const JOURNEYS: readonly Weighted<Journey>[] = [
  { item: 'bounce', weight: 32 },
  { item: 'browse', weight: 28 },
  { item: 'cart', weight: 14 },
  { item: 'purchase', weight: 12 },
  { item: 'sign-up', weight: 9 },
  { item: 'returning', weight: 5 },
];

const BOUNCE_PAGES = ['/', '/products/:id', ...DEMO_BLOG_PATHS] as const;

interface VisitTraits {
  readonly sessionId: string;
  readonly device: DemoDevice;
  readonly place: DemoPlace;
  readonly attribution: Attribution;
}

class VisitRecorder {
  private readonly recorded: TrackedEvent[] = [];
  private currentPath = '/';
  private userId: string | null = null;

  constructor(
    private readonly random: SeededRandom,
    private readonly projectId: string,
    private readonly traits: VisitTraits,
    private clock: number,
  ) {}

  get events(): readonly TrackedEvent[] {
    return this.recorded;
  }

  page(path: string): void {
    this.currentPath = path;
    this.record(PAGE_VIEW, {});
  }

  event(name: string, properties: PropertyMap = {}): void {
    this.record(name, properties);
  }

  request(method: string, route: string, outcome: DemoRequestOutcome): boolean {
    const failed = outcome.status >= SUCCESS_STATUS_LIMIT;
    const duration =
      this.random.integer(FASTEST_REQUEST_MS, SLOWEST_REQUEST_MS) +
      (failed ? FAILED_REQUEST_EXTRA_MS : 0);
    this.record(API_REQUEST, {
      method,
      route,
      status: outcome.status,
      duration_ms: duration,
      ...(outcome.errorCode === null ? {} : { error_code: outcome.errorCode }),
    });
    return !failed;
  }

  identify(userId: string): void {
    this.userId = userId;
  }

  private record(name: string, properties: PropertyMap): void {
    const isLanding = this.recorded.length === 0;
    this.clock +=
      this.random.integer(SHORTEST_PAUSE_SECONDS, LONGEST_PAUSE_SECONDS) * MILLISECONDS_PER_SECOND;
    this.recorded.push({
      id: this.random.uuid(),
      projectId: this.projectId,
      name,
      occurredAt: new Date(this.clock),
      receivedAt: new Date(
        this.clock + this.random.integer(FASTEST_DELIVERY_MS, SLOWEST_DELIVERY_MS),
      ),
      sessionId: this.traits.sessionId,
      userId: this.userId,
      path: this.currentPath,
      attribution: isLanding ? this.traits.attribution : null,
      channel: isLanding ? classifyChannel(this.traits.attribution) : null,
      deviceType: this.traits.device.deviceType,
      browser: this.traits.device.browser,
      os: this.traits.device.os,
      country: this.traits.place.country,
      region: this.traits.place.region,
      regionName: this.traits.place.regionName,
      city: demoCityOf(this.traits.place, this.traits.sessionId),
      properties,
    });
  }
}

function personId(random: SeededRandom): string {
  const letters = Array.from({ length: PERSON_ID_LENGTH }, () =>
    PERSON_ID_LETTERS.charAt(random.integer(0, PERSON_ID_LETTERS.length - 1)),
  );
  return `cust_${letters.join('')}`;
}

export function demoPeople(projectId: string): readonly string[] {
  const random = seededRandom(`${projectId}:people`);
  return Array.from({ length: DEMO_PEOPLE }, () => personId(random));
}

function somePerson(random: SeededRandom, people: readonly string[]): string {
  return random.chance(LOYAL_VISIT_CHANCE)
    ? random.pick(people.slice(0, DEMO_LOYAL_PEOPLE))
    : random.pick(people);
}

function browse(random: SeededRandom, visit: VisitRecorder): void {
  visit.page(random.pick(['/', '/products']));
  if (random.chance(DEMO_FAILED_READ_CHANCE)) {
    visit.request('GET', '/products', random.weighted(DEMO_FAILED_READS));
  }
  if (random.chance(DEMO_SEARCH_CHANCE)) {
    visit.event('search', { results: random.integer(0, 40) });
  }
  const products = random.integer(1, 4);
  for (let product = 0; product < products; product += 1) {
    visit.page('/products/:id');
    visit.event('product_viewed', { category: random.pick(DEMO_CATEGORIES) });
  }
}

function addToCart(random: SeededRandom, visit: VisitRecorder): boolean {
  const added = visit.request('POST', '/cart/items', random.weighted(DEMO_CART_OUTCOMES));
  if (!added) {
    return false;
  }
  visit.event('added_to_cart', {
    category: random.pick(DEMO_CATEGORIES),
    quantity: random.integer(1, 3),
  });
  visit.page('/cart');
  return true;
}

function placeOrder(random: SeededRandom, visit: VisitRecorder): void {
  const items = random.integer(1, 4);
  visit.page('/checkout');
  visit.event('checkout_started', { items });
  const placed =
    visit.request('POST', '/orders', random.weighted(DEMO_ORDER_OUTCOMES)) ||
    (random.chance(DEMO_ORDER_RETRY_CHANCE) &&
      visit.request('POST', '/orders', random.weighted(DEMO_ORDER_OUTCOMES)));
  if (placed) {
    visit.event('order_placed', { payment_method: random.pick(DEMO_PAYMENT_METHODS), items });
    visit.page('/orders/:id');
  }
}

function signIn(random: SeededRandom, visit: VisitRecorder, people: readonly string[]): boolean {
  visit.page('/sign-in');
  const signedIn = visit.request('POST', '/sessions', random.weighted(DEMO_SIGN_IN_OUTCOMES));
  if (signedIn) {
    visit.identify(somePerson(random, people));
  }
  return signedIn;
}

function signUp(random: SeededRandom, visit: VisitRecorder, people: readonly string[]): void {
  visit.page('/pricing');
  if (random.chance(DEMO_PRICING_EXIT_CHANCE)) {
    return;
  }
  visit.page('/sign-up');
  if (random.chance(DEMO_SIGN_UP_PAGE_EXIT_CHANCE)) {
    return;
  }
  visit.event('sign_up_started');
  if (visit.request('POST', '/sign-up', random.weighted(DEMO_SIGN_UP_OUTCOMES))) {
    visit.identify(random.pick(people));
    visit.event(DEMO_CONVERSION_EVENT, { plan: random.pick(DEMO_PLANS) });
    visit.page('/welcome');
  }
}

type Walk = (random: SeededRandom, visit: VisitRecorder, people: readonly string[]) => void;

const WALKS: Readonly<Record<Journey, Walk>> = {
  bounce: (random, visit) => {
    visit.page(random.pick(BOUNCE_PAGES));
  },
  browse: (random, visit) => {
    browse(random, visit);
  },
  cart: (random, visit) => {
    browse(random, visit);
    addToCart(random, visit);
  },
  purchase: (random, visit, people) => {
    browse(random, visit);
    if (addToCart(random, visit) && signIn(random, visit, people)) {
      placeOrder(random, visit);
    }
  },
  'sign-up': (random, visit, people) => {
    signUp(random, visit, people);
  },
  returning: (random, visit, people) => {
    if (signIn(random, visit, people)) {
      visit.page('/orders');
      visit.page('/orders/:id');
    }
  },
};

export function demoVisitCount(isoDate: string, random: SeededRandom): number {
  const base = Number(DEMO_VISITS_BY_WEEKDAY[isoWeekday(isoDate) - 1]);
  return Math.round(base * (1 - DEMO_DAILY_VARIATION / 2 + random.next() * DEMO_DAILY_VARIATION));
}

export function demoEventsOfDay(
  projectId: string,
  isoDate: string,
  timeZone: string,
): readonly TrackedEvent[] {
  const random = seededRandom(`${projectId}:${isoDate}`);
  const people = demoPeople(projectId);
  const visits = demoVisitCount(isoDate, random);
  return Array.from({ length: visits }, () => {
    const minute =
      random.weighted(DEMO_VISITS_BY_HOUR) * MINUTES_PER_HOUR +
      random.integer(0, MINUTES_PER_HOUR - 1);
    const visit = new VisitRecorder(
      random,
      projectId,
      {
        sessionId: random.uuid(),
        device: random.weighted(DEMO_DEVICES),
        place: random.weighted(DEMO_PLACES),
        attribution: random.weighted(DEMO_SOURCES),
      },
      instantInZone(isoDate, minute, timeZone).getTime(),
    );
    WALKS[random.weighted(JOURNEYS)](random, visit, people);
    return visit.events;
  }).flat();
}
