export type AuthorizationResponseParameters = Readonly<Record<string, string | null>>;

export function authorizationResponseUrl(
  redirectUri: string,
  parameters: AuthorizationResponseParameters,
  issuer: string,
): string {
  const url = new URL(redirectUri);
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== null) {
      url.searchParams.set(name, value);
    }
  }
  url.searchParams.set('iss', issuer);
  return url.toString();
}

export function consentUrl(dashboardOrigin: string, requestId: string): string {
  const url = new URL('/connect', dashboardOrigin);
  url.searchParams.set('request', requestId);
  return url.toString();
}
