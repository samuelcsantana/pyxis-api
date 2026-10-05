const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export function normalizeCountry(viewerCountry: string | undefined): string | null {
  return viewerCountry !== undefined && COUNTRY_CODE_PATTERN.test(viewerCountry)
    ? viewerCountry
    : null;
}
