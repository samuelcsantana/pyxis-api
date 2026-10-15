import {
  ALLOWED_CLIENTS,
  allowedClient,
  CLAUDE_CLIENT_ID,
  CLAUDE_CODE_CLIENT_ID,
  hostnameOf,
  isLoopbackRedirect,
  isRegisteredRedirect,
} from './oauth-clients';

const claude = {
  clientId: CLAUDE_CLIENT_ID,
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
};
const claudeCode = {
  clientId: CLAUDE_CODE_CLIENT_ID,
  redirectUris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
};

describe('allowed oauth clients', () => {
  it('knows Claude and Claude Code by the address of their metadata document, nothing else', () => {
    expect(ALLOWED_CLIENTS.map((client) => [client.id, client.name])).toEqual([
      [CLAUDE_CLIENT_ID, 'Claude'],
      [CLAUDE_CODE_CLIENT_ID, 'Claude Code'],
    ]);
    expect(allowedClient(CLAUDE_CODE_CLIENT_ID)?.name).toBe('Claude Code');
    expect(allowedClient('https://evil.example.com/client.json')).toBeNull();
    expect(allowedClient('Claude')).toBeNull();
  });

  it('keeps the documents as published on 2026-10-15 as the fallback copy', () => {
    expect(allowedClient(CLAUDE_CLIENT_ID)?.knownMetadata).toEqual(claude);
    expect(allowedClient(CLAUDE_CODE_CLIENT_ID)?.knownMetadata).toEqual(claudeCode);
  });

  it('matches a web redirect address exactly', () => {
    expect(isRegisteredRedirect(claude, 'https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isRegisteredRedirect(claude, 'https://claude.ai/api/mcp/auth_callback/')).toBe(false);
    expect(isRegisteredRedirect(claude, 'https://claude.ai:8443/api/mcp/auth_callback')).toBe(
      false,
    );
    expect(isRegisteredRedirect(claude, 'https://evil.example.com/callback')).toBe(false);
  });

  it('matches a loopback redirect on any port, as RFC 8252 asks', () => {
    expect(isRegisteredRedirect(claudeCode, 'http://localhost:53682/callback')).toBe(true);
    expect(isRegisteredRedirect(claudeCode, 'http://127.0.0.1:1/callback')).toBe(true);
    expect(isRegisteredRedirect(claudeCode, 'http://localhost/callback')).toBe(true);
  });

  it('refuses a loopback redirect with another path, scheme, host, query, user or fragment', () => {
    expect(isRegisteredRedirect(claudeCode, 'http://localhost:53682/other')).toBe(false);
    expect(isRegisteredRedirect(claudeCode, 'https://localhost:53682/callback')).toBe(false);
    expect(isRegisteredRedirect(claudeCode, 'http://localhost.evil.com:53682/callback')).toBe(
      false,
    );
    expect(isRegisteredRedirect(claudeCode, 'http://localhost:53682/callback?next=1')).toBe(false);
    expect(isRegisteredRedirect(claudeCode, 'http://user@localhost:53682/callback')).toBe(false);
    expect(isRegisteredRedirect(claudeCode, 'http://localhost:53682/callback#top')).toBe(false);
    expect(isRegisteredRedirect(claudeCode, 'not a url')).toBe(false);
  });

  it('never extends the any-port rule to a registered address that names its port', () => {
    const pinned = { clientId: 'x', redirectUris: ['http://localhost:8080/callback'] };

    expect(isRegisteredRedirect(pinned, 'http://localhost:9090/callback')).toBe(false);
  });

  it('tells a loopback redirect from a web one', () => {
    expect(isLoopbackRedirect('http://127.0.0.1:4000/callback')).toBe(true);
    expect(isLoopbackRedirect('http://[::1]:4000/callback')).toBe(true);
    expect(isLoopbackRedirect('https://claude.ai/api/mcp/auth_callback')).toBe(false);
    expect(isLoopbackRedirect('https://localhost/callback')).toBe(false);
    expect(isLoopbackRedirect('nonsense')).toBe(false);
  });

  it('names an address by its host name, without the port', () => {
    expect(hostnameOf(CLAUDE_CLIENT_ID)).toBe('claude.ai');
    expect(hostnameOf('http://localhost:53682/callback')).toBe('localhost');
  });
});
