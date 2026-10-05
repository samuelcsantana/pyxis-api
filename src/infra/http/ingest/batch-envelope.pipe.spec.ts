import { PUBLIC_KEY_PREFIX } from '../../../domain/keys/project-keys';
import { InvalidBatchError } from '../errors/http-errors';
import { BatchEnvelopePipe } from './batch-envelope.pipe';

const KEY = `${PUBLIC_KEY_PREFIX}${'A'.repeat(32)}`;

describe('BatchEnvelopePipe', () => {
  it('passes a batch whose top level matches the contract, events untouched', () => {
    const batch = { key: KEY, sent_at: '2026-10-06T14:00:06.000Z', events: [{ anything: 1 }] };

    expect(new BatchEnvelopePipe().transform(batch)).toEqual(batch);
  });

  it.each([null, 'text', { key: KEY }, { key: KEY, sent_at: 'now', events: [{}] }])(
    'refuses %j as an invalid batch',
    (value) => {
      expect(() => new BatchEnvelopePipe().transform(value)).toThrow(InvalidBatchError);
    },
  );
});
