import { FakeSecretBox, InMemorySlackWebhookRepository } from './in-memory-slack';

describe('InMemorySlackWebhookRepository', () => {
  it('marks nothing broken for a project with no webhook', async () => {
    const webhooks = new InMemorySlackWebhookRepository();

    await webhooks.markBroken('missing', 'no_service', new Date('2026-11-05T00:00:00.000Z'));

    await expect(webhooks.statusOf('missing')).resolves.toBeNull();
  });
});

describe('FakeSecretBox', () => {
  it('opens only in the context it sealed in', () => {
    const box = new FakeSecretBox();
    const sealed = box.seal('secret', 'here');

    expect(box.open(sealed, 'here')).toBe('secret');
    expect(() => box.open(sealed, 'there')).toThrow('another context');
  });
});
