# 38. The MCP endpoint runs the tools of pyxis-mcp inside the API

Date: 2026-10-15

## Status

Accepted. Completes [ADR 0037](0037-the-api-is-its-own-oauth-server-for-claude.md) (the API is its
own OAuth server for Claude) and builds on
[ADR 0015](0015-read-only-access-tokens-for-agents.md) (read-only access tokens).

## Context

Claude and Claude Code add a remote MCP server by its address. The OAuth half lives in the API
since ADR 0037; what was missing is the address itself, `${API_ORIGIN}/mcp`, the resource every
connection token is issued for.

The fifteen read-only tools already exist in the public `pyxis-mcp` package, which runs on a
person's computer over stdio and reads the API with a token. Since version 0.2.0 it also exports
them as a library: `createServer`, `PyxisApi` (the HTTP client the tools read through, with a
`fetch` and the wording of its errors as options) and `handleHttpRequest`, a stateless Streamable
HTTP handler that takes a web `Request` and answers a web `Response`, refusing any method but
`POST` (405) and any request with an `Origin` header (403).

The MCP authorization specification forbids a server from passing on the token it received to
another service, and the MCP client only signs in when the HTTP answer is a 401 with
`WWW-Authenticate`: an error inside a tool comes back as a 200 and never starts a sign-in.

## Decision

1. **`/mcp` is a route of the API**, behind `REMOTE_MCP_OPEN` like the OAuth server: while it is
   off, `/mcp` and its metadata answer 404, before any token is looked at.
2. **The tools come from `pyxis-mcp`, pinned to an exact version**, so the local package and the
   connector cannot disagree about what a tool reads or how it reports. The library, and the MCP
   SDK under it, load on the first `/mcp` request, not when the function starts, so the cold start
   of every other route does not pay for them.
3. **A guard answers the 401 before the library runs.** It accepts `Authorization: Bearer` with a
   connection's access token (`pyxis_oat_`) or a read-only token (`pyxis_at_`) and nothing else;
   the dashboard's session cookie is never read here. Without a token the challenge is
   `Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp", scope="read"`; with a
   refused one it also carries `error="invalid_token"`, which is what makes a client refresh after
   the one-hour access token expires.
4. **The protected resource metadata (RFC 9728)** is served at
   `/.well-known/oauth-protected-resource/mcp` and, for clients that look there first, at
   `/.well-known/oauth-protected-resource`: the resource is `${API_ORIGIN}/mcp`, the only
   authorization server the API itself, the scope `read`, tokens in the header only.
5. **Each tool reads through the API, in process.** The handler gives `PyxisApi` a `fetch` that is
   Fastify's `inject()`: every tool becomes a `GET` of the dashboard route it reads, with the
   caller's token, through the same guards, Zod validation, project scope, account state and
   limits as any other request. The token never leaves the process that issued it. That `fetch`
   only ever sends `GET`, only to the API's own origin, and stops waiting when the tool does.
6. **Limits stay per token, never per address** (every call from claude.ai leaves from the same
   range of addresses): 120 messages a minute to `/mcp`, while each tool read counts against the
   route it reads, as any request with that token does.
7. **Error texts depend on how the token was given**: a refused connection asks the person to
   connect Pyxis again in Claude; a refused read-only token asks them to create another one in
   Settings.
8. **Only the API's own name serves the connector.** The distribution still answers on an older
   name while the sites that used it move. A token names one resource address, so on any host but
   `api_domain` a CloudFront Function answers 404 on `/mcp`, `/oauth/*` and
   `/.well-known/oauth-*`; the API never sees the viewer's host behind CloudFront, so the check
   lives at the edge, on those three paths only, and ingestion never runs it.

## Consequences

- The API's production dependencies now include `pyxis-mcp` and, through it, the MCP SDK and its
  own dependencies (MIT, ISC and BSD licenses). The production audit covers them, so an advisory
  in code the API never calls can still turn the audit red until it is updated.
- A new tool, or a change in what one reads, ships twice: a release of `pyxis-mcp`, then a bump
  in the API. The daily contract check of `pyxis-mcp` reports when its tools and the API's routes
  disagree.
- A message is limited by the API's body limit (32 KiB), below the library's own 64 KiB.
- A tool read is a second authentication of the same token, one more database lookup per tool
  call; in exchange there is no second way to reach the data.
- The limits live in each execution environment's memory, as every other limit of the API, and
  the reserved concurrency bounds their worst case.
