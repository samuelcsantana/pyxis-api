import type { DigestRecipient, DigestRecipientsQuery } from '../domain/digest/digest-recipients';

export class StubDigestRecipientsQuery implements DigestRecipientsQuery {
  answer: readonly DigestRecipient[] = [];

  recipients(): Promise<readonly DigestRecipient[]> {
    return Promise.resolve(this.answer);
  }
}
