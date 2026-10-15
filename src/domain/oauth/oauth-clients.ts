export interface ClientMetadata {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
}

export interface AllowedClient {
  readonly id: string;
  readonly name: string;
  readonly knownMetadata: ClientMetadata;
}

function allowedClientOf(id: string, name: string, redirectUris: readonly string[]): AllowedClient {
  return { id, name, knownMetadata: { clientId: id, redirectUris } };
}

export const CLAUDE_CLIENT_ID = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
export const CLAUDE_CODE_CLIENT_ID = 'https://claude.ai/oauth/claude-code-client-metadata';

export const ALLOWED_CLIENTS: readonly AllowedClient[] = [
  allowedClientOf(CLAUDE_CLIENT_ID, 'Claude', ['https://claude.ai/api/mcp/auth_callback']),
  allowedClientOf(CLAUDE_CODE_CLIENT_ID, 'Claude Code', [
    'http://localhost/callback',
    'http://127.0.0.1/callback',
  ]),
];

export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

export function allowedClient(clientId: string): AllowedClient | null {
  return ALLOWED_CLIENTS.find((client) => client.id === clientId) ?? null;
}

function parsedUrl(value: string): URL | null {
  return URL.canParse(value) ? new URL(value) : null;
}

export function isLoopbackRedirect(redirectUri: string): boolean {
  const url = parsedUrl(redirectUri);
  return url !== null && url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

function matchesIgnoringPort(registered: URL, requested: URL): boolean {
  return (
    registered.protocol === requested.protocol &&
    registered.hostname === requested.hostname &&
    registered.pathname === requested.pathname &&
    registered.search === requested.search &&
    requested.username === '' &&
    requested.password === '' &&
    requested.hash === ''
  );
}

function matchesRegistered(registeredUri: string, requestedUri: string): boolean {
  if (registeredUri === requestedUri) {
    return true;
  }
  const registered = parsedUrl(registeredUri);
  const requested = parsedUrl(requestedUri);
  return (
    registered !== null &&
    requested !== null &&
    registered.port === '' &&
    isLoopbackRedirect(registeredUri) &&
    matchesIgnoringPort(registered, requested)
  );
}

export function isRegisteredRedirect(metadata: ClientMetadata, redirectUri: string): boolean {
  return metadata.redirectUris.some((registered) => matchesRegistered(registered, redirectUri));
}

export function hostnameOf(uri: string): string {
  return new URL(uri).hostname;
}
