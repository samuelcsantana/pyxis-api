# 13. Fetch each project's icon from its site, and keep a copy

Date: 2026-10-11

## Status

Accepted. Builds on [ADR 0011](0011-weekly-digest-from-the-jobs-function.md) (the daily jobs
function it runs in) and [ADR 0012](0012-session-cookie-set-by-the-dashboard.md) (why the dashboard
serves the image from its own host).

## Context

The dashboard's project switcher showed two letters of each project's name on the same colour, so
two projects looked alike. Every project already lists the origin of its site, and sites declare
an icon. Three ways to show it were weighed: a third-party favicon service (one line, but it sends
every project's domain to someone else, against Pyxis's "no third parties"), the browser loading
the icon straight from the site (the dashboard's CSP would have to allow every customer's host,
and the path of the icon has to be guessed), or the API fetching and keeping it.

## Decision

- **Where it comes from:** the home page of the project's first allowed origin. The touch icon is
  preferred, then the largest declared icon, then `/favicon.ico`. Only raster images are kept
  (PNG, ICO, JPEG, WEBP, GIF, checked by their first bytes, not by the type the site claims), up to
  100 KB; SVG is refused because it can carry script.
- **When:** last step of the daily jobs run, one project after another, best effort. An icon found
  replaces the stored one, a site that answers without one loses it, a site that cannot be reached
  keeps it. A failure never fails the run.
- **Guarding the fetch:** it is the only request the API makes to an address it does not choose,
  and the functions run outside a VPC with the Lambda runtime API on localhost. So: https only;
  the host is resolved before every request and refused if any address is loopback, private,
  link-local, carrier-grade NAT, unique-local, multicast or reserved; at most three redirects,
  followed by hand under the same check; five seconds per request; the page read up to 512 KB.
- **Storage and serving:** `project_icons` keeps the bytes, a short hash of them (`version`), the
  address they came from and when. `GET /v1/projects/:projectId/icon` answers them to admins of
  the project, cached privately for a day, with the strict headers of every response; `GET /v1/me`
  carries `icon_version` so the dashboard can cache the image by URL until the icon changes. The
  dashboard serves the image from its own host, forwarding the session as it does for every call.

## Consequences

- No third party learns which sites use Pyxis, and the dashboard's CSP stays `img-src 'self'`.
- A new icon shows up within a day, or at once after a manual run of the daily job.
- Residual risk: a host can resolve to a public address when checked and to a private one when the
  request connects (DNS rebinding). The check per request and per redirect narrows it; pinning the
  checked address on the socket would close it, at the cost of replacing the platform `fetch`.
- A site that serves its icon only as SVG keeps the initials.
