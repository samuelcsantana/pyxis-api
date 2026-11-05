import { InvalidSlackWebhookError } from '../errors/slack.errors';
import {
  brokenReasonOf,
  isSlackWebhookUrl,
  MAX_SLACK_BROKEN_REASON_LENGTH,
  MAX_SLACK_WEBHOOK_LENGTH,
  requireSlackWebhookUrl,
  SLACK_WEBHOOK_HINT_LENGTH,
  slackWebhookContext,
  slackWebhookHint,
} from './slack-webhook';

const WEBHOOK = 'https://hooks.slack.com/services/T0001/B0002/abcdefghijklWXYZ';

describe('the Slack webhook limits', () => {
  it('are the documented ones', () => {
    expect({
      MAX_SLACK_WEBHOOK_LENGTH,
      SLACK_WEBHOOK_HINT_LENGTH,
      MAX_SLACK_BROKEN_REASON_LENGTH,
    }).toEqual({
      MAX_SLACK_WEBHOOK_LENGTH: 256,
      SLACK_WEBHOOK_HINT_LENGTH: 4,
      MAX_SLACK_BROKEN_REASON_LENGTH: 64,
    });
  });
});

describe('isSlackWebhookUrl', () => {
  it('accepts a Slack Incoming Webhook address', () => {
    expect(isSlackWebhookUrl(WEBHOOK)).toBe(true);
  });

  it.each([
    ['another host', 'https://example.com/services/T0001/B0002/abcdefghijkl'],
    [
      'a host that only starts like Slack',
      'https://hooks.slack.com.example.com/services/T0/B0/abcdefghijkl',
    ],
    ['plain HTTP', 'http://hooks.slack.com/services/T0001/B0002/abcdefghijkl'],
    ['a port', 'https://hooks.slack.com:8443/services/T0001/B0002/abcdefghijkl'],
    ['credentials', 'https://user@hooks.slack.com/services/T0001/B0002/abcdefghijkl'],
    ['a query', 'https://hooks.slack.com/services/T0001/B0002/abcdefghijkl?x=1'],
    ['a fragment', 'https://hooks.slack.com/services/T0001/B0002/abcdefghijkl#x'],
    ['a path that climbs', 'https://hooks.slack.com/services/T0001/../B0002/abcdefghijkl'],
    ['a workflow webhook', 'https://hooks.slack.com/workflows/T0001/B0002/abcdefghijkl'],
    ['a short secret', 'https://hooks.slack.com/services/T0001/B0002/abc'],
  ])('refuses %s', (_label, url) => {
    expect(isSlackWebhookUrl(url)).toBe(false);
  });

  it('refuses an address longer than the limit, even one that matches', () => {
    const long = `https://hooks.slack.com/services/${'T'.repeat(32)}/${'B'.repeat(32)}/${'a'.repeat(64)}`;
    const padded = `${long}${'a'.repeat(MAX_SLACK_WEBHOOK_LENGTH)}`;

    expect(isSlackWebhookUrl(long)).toBe(true);
    expect(isSlackWebhookUrl(padded)).toBe(false);
  });
});

describe('requireSlackWebhookUrl', () => {
  it('answers the address without the spaces around it', () => {
    expect(requireSlackWebhookUrl(`  ${WEBHOOK}\n`)).toBe(WEBHOOK);
  });

  it('refuses anything else', () => {
    expect(() => requireSlackWebhookUrl('https://example.com/hook')).toThrow(
      InvalidSlackWebhookError,
    );
  });
});

describe('the stored parts of a webhook', () => {
  it('keep only the last four characters as the hint', () => {
    expect(slackWebhookHint(WEBHOOK)).toBe('WXYZ');
  });

  it('cut what Slack answered to the stored length', () => {
    expect(brokenReasonOf('no_service')).toBe('no_service');
    expect(brokenReasonOf('x'.repeat(100))).toHaveLength(MAX_SLACK_BROKEN_REASON_LENGTH);
  });

  it('seal each address for its own project', () => {
    expect(slackWebhookContext('p-1')).toBe('slack-webhook:p-1');
  });
});
