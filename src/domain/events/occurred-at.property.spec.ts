import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { MAX_DELIVERY_DELAY_MS, MAX_OCCURRED_AT_AGE_MS } from './event-limits';
import { correctOccurredAt } from './occurred-at';

const FIRST_RECEPTION = Date.UTC(2000, 0, 1);
const LAST_RECEPTION = Date.UTC(2099, 11, 31);
const MAX_GENERATED_SKEW_MS = 30 * 24 * 60 * 60 * 1000;

const receivedAt = fc.integer({ min: FIRST_RECEPTION, max: LAST_RECEPTION });
const nearby = fc.integer({ min: -MAX_GENERATED_SKEW_MS, max: MAX_GENERATED_SKEW_MS });
const anyDate = fc.date({ noInvalidDate: true });
const withinAge = fc.integer({ min: -MAX_OCCURRED_AT_AGE_MS, max: 0 });
const deliveryDelay = fc.oneof(
  fc.constantFrom(0, MAX_DELIVERY_DELAY_MS - 1),
  fc.integer({ min: 0, max: MAX_DELIVERY_DELAY_MS - 1 }),
);
const disagreeingClock = fc.oneof(
  fc.constantFrom(-MAX_DELIVERY_DELAY_MS, 1),
  fc.integer({ min: -MAX_GENERATED_SKEW_MS, max: -MAX_DELIVERY_DELAY_MS }),
  fc.integer({ min: 1, max: MAX_GENERATED_SKEW_MS }),
);

function around(base: number, offset: fc.Arbitrary<number>): fc.Arbitrary<Date> {
  return offset.map((milliseconds) => new Date(base + milliseconds));
}

describe('correctOccurredAt, for any clocks', () => {
  it('never places an event after its reception or before the oldest time accepted', () => {
    fc.assert(
      fc.property(
        receivedAt.chain((received) =>
          fc.tuple(
            fc.constant(new Date(received)),
            fc.oneof(around(received, nearby), anyDate),
            fc.oneof(around(received, nearby), anyDate),
          ),
        ),
        ([received, sentAt, occurredAt]) => {
          const corrected = correctOccurredAt(occurredAt, sentAt, received).getTime();

          expect(corrected).toBeLessThanOrEqual(received.getTime());
          expect(corrected).toBeGreaterThanOrEqual(received.getTime() - MAX_OCCURRED_AT_AGE_MS);
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps the browser time of a batch that took less than the delivery delay to arrive', () => {
    fc.assert(
      fc.property(receivedAt, deliveryDelay, withinAge, (received, delay, age) => {
        const occurredAt = new Date(received + age);
        const sentAt = new Date(received - delay);

        expect(correctOccurredAt(occurredAt, sentAt, new Date(received))).toEqual(occurredAt);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps how long before sending an event happened, when the browser clock disagrees', () => {
    fc.assert(
      fc.property(
        receivedAt,
        disagreeingClock,
        withinAge,
        (received, clockError, beforeSending) => {
          const sentAt = new Date(received + clockError);
          const occurredAt = new Date(sentAt.getTime() + beforeSending);

          expect(correctOccurredAt(occurredAt, sentAt, new Date(received))).toEqual(
            new Date(received + beforeSending),
          );
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });
});
