# 37. The API is its own OAuth server for Claude

Date: 2026-10-15

## Status

Accepted. Builds on [ADR 0015](0015-read-only-access-tokens-for-agents.md) (read-only access
tokens) and [ADR 0030](0030-the-operator-can-stop-a-person-and-a-token.md) (stopping a person).

## Context

Claude (on the web, the desktop and the phone) and Claude Code add a remote MCP server as a
connector by its address, then sign in through OAuth 2.1 the way the MCP authorization
specification describes: the server answers 401, the client discovers the authorization server,
the person consents in a browser, and the client receives tokens it refreshes on its own. The
local `pyxis-mcp` package needs a token pasted into a configuration file and Node on the
computer; a connector needs neither.

The MCP specification forbids a server from passing on to another service the token it received.
If the MCP endpoint lived anywhere but the API, it would have to do exactly that to read the
numbers. The API already authenticates every read, scopes it to the projects a person sees and
limits it per token.

## Decision

1. **The API is the issuer and the resource at once.** `/.well-known/oauth-authorization-server`
   (RFC 8414), `/oauth/authorize`, `/oauth/token` and `/oauth/revoke` (RFC 7009) live in the API;
   the issuer is `API_ORIGIN` and the only resource is `${API_ORIGIN}/mcp`. A `resource` other than
   that is refused with `invalid_target`; one left out means that one.
2. **Two clients, by the address of their metadata document, nothing else.** Claude
   (`https://claude.ai/oauth/mcp-oauth-client-metadata`) and Claude Code
   (`https://claude.ai/oauth/claude-code-client-metadata`). No dynamic registration. The document
   is fetched only at `/oauth/authorize`, only at those two addresses, without following redirects,
   in five seconds and 16 KiB at most, kept for a day, and must name its own address as
   `client_id`, use `none` as the token endpoint authentication and list https or loopback return
   addresses. When it cannot be read, the last good copy is used, then the copy known when the
   code was written. The token endpoint never fetches.
3. **Return addresses are matched exactly**, except loopback ones registered without a port
   (`http://localhost/callback`), which match on any port (RFC 8252). An unknown client or an
   unregistered return address is answered at `/oauth/authorize` and never redirected; any other
   refusal goes back to the client with `error`, `state` and `iss` (RFC 9207).
4. **PKCE with S256 is required**; the scope is always `read` (a requested scope is ignored).
5. **Consent is a page of the dashboard.** A valid request is kept for ten minutes and the browser
   goes to `/connect?request=<id>` on `DASHBOARD_ORIGIN`. The dashboard reads it
   (`GET /v1/oauth/requests/{id}`, the client named by our list and shown by the host of its
   document address, never by the name the document declares) and answers it
   (`POST …/approve` or `…/deny`, with the dashboard's `Origin`); the API answers where to send the
   browser. A request is answered once.
6. **A connection is a grant of one person to one client.** Approving issues a code that works
   once within five minutes; trading it creates the connection with an access token
   (`pyxis_oat_`, one hour) and a refresh token (`pyxis_ort_`). Every code and token carries 256
   random bits and is stored only as a SHA-256 hash, in three tables: requests, connections and
   their tokens.
7. **A refresh token is traded once.** Presented again within a minute (two refreshes of the same
   client at once) it gets another pair, until the connection holds three live access tokens: from
   then on the replay is refused and the connection stays (since 2026-10-24; before, each replay in
   that minute added a pair). Later, the whole connection ends, and a code presented twice ends the
   connection it made. A connection ends after ninety days without use, and its use is recorded at
   most every five minutes and at every refresh. At most ten live connections per person.
8. **A connection reads what a read-only token reads** and nothing else: the routes behind
   `ReadAccess` accept `Authorization: Bearer pyxis_oat_…` and judge the request by it; writes,
   sessions, tokens, connections and preferences refuse it.
9. **Connections are seen and ended by their person** (`GET /v1/me/connections`, which also says
   whether connecting is open and the address to add; `DELETE /v1/me/connections/{id}`), by the
   client (`/oauth/revoke` with either token ends the connection), by the operator
   (`connection:revoke`) and by `admin:suspend`. Deleting a person deletes their connections.
   Signing out everywhere does not disconnect applications, as it does not revoke tokens.
10. **Errors of the token and revocation endpoints follow RFC 6749, section 5.2**
    (`{"error","error_description"}`, 401 for `invalid_client`, 400 otherwise); the other routes
    keep the API's error shape.
11. **No limit per address that a client shares with everyone**: every call from claude.ai comes
    from the same range, so the token endpoint has only a circuit breaker of 600 calls a minute
    per address, while `/oauth/authorize`, reached from the person's browser, allows 60.
12. **`REMOTE_MCP_OPEN` switches it all on**, false by default: while off, the OAuth addresses and
    the consent routes answer 404, as an address that does not exist.
13. **The daily job sweeps** revoked and idle connections, expired tokens, refresh tokens traded
    more than thirty days ago and requests expired more than a day ago.

## Consequences

- Nothing new to run: the same function, distribution and database.
- Clients that the list does not name (other applications, other editors) keep using the local
  package or a personal token; opening the list to any metadata document, or to dynamic
  registration, is a later decision with its own risks (fetching arbitrary addresses, consent
  asked by unknown applications).
- Form bodies are parsed by the parser the framework registers for every route; a parameter sent
  twice arrives as a list and is refused as `invalid_request`.
- The issuer is configuration, not the host a request arrived at: behind CloudFront the function
  never sees the viewer's host. A client that typed an older name of the API sends a different
  `resource` and is refused.
- The MCP endpoint itself, its `401` with `WWW-Authenticate` and the protected resource metadata
  come next, in the same API.
