import fc from 'fast-check';
import { PROPERTY_PARAMETERS, signUpEmailAddress } from '../../test-utils/property-testing';
import { mailboxOf } from './mailbox';

const MAX_ADDRESS = 254;

describe('mailboxOf', () => {
  it('drops the tag after a plus sign, on any domain', () => {
    expect(mailboxOf('ana+news@example.com')).toBe('ana@example.com');
    expect(mailboxOf('ana+a+b@gmail.com')).toBe('ana@gmail.com');
  });

  it('keeps a local part that starts with the plus sign, since nothing is left before it', () => {
    expect(mailboxOf('+ana@example.com')).toBe('+ana@example.com');
  });

  it('drops the dots of a Gmail address and only of a Gmail address', () => {
    expect(mailboxOf('a.n.a@gmail.com')).toBe('ana@gmail.com');
    expect(mailboxOf('a.n.a@example.com')).toBe('a.n.a@example.com');
  });

  it('reads googlemail.com as gmail.com', () => {
    expect(mailboxOf('a.na+x@googlemail.com')).toBe('ana@gmail.com');
  });

  it('ignores letter case', () => {
    expect(mailboxOf('Ana.B+News@GMail.COM')).toBe('anab@gmail.com');
  });

  it('keeps an address with no domain as the database column does, with nothing after the at sign', () => {
    expect(mailboxOf('nobody')).toBe('nobody@');
  });

  it('is already a mailbox once applied, for any address the sign-up accepts', () => {
    fc.assert(
      fc.property(signUpEmailAddress(MAX_ADDRESS), (address) => {
        const mailbox = mailboxOf(address);
        expect(mailboxOf(mailbox)).toBe(mailbox);
        expect(mailbox.length).toBeLessThanOrEqual(address.length);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('gives a tagged Gmail address with dots the mailbox of the plain one', () => {
    const word = fc.stringMatching(/^[a-z0-9]{1,8}$/);
    fc.assert(
      fc.property(word, word, word, (first, second, tag) => {
        expect(mailboxOf(`${first}.${second}+${tag}@gmail.com`)).toBe(
          mailboxOf(`${first}${second}@googlemail.com`),
        );
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
