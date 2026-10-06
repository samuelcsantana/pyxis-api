import { likePattern } from './funnel';

describe('likePattern', () => {
  it('turns each star into any run of characters', () => {
    expect(likePattern('/calculadora-*')).toBe('/calculadora-%');
    expect(likePattern('/blog/*/comments/*')).toBe('/blog/%/comments/%');
  });

  it('keeps percent signs, underscores and backslashes literal', () => {
    expect(likePattern('/50%_off')).toBe('/50\\%\\_off');
    expect(likePattern('/a\\b')).toBe('/a\\\\b');
  });

  it('leaves a plain path as it is', () => {
    expect(likePattern('/pricing')).toBe('/pricing');
  });
});
