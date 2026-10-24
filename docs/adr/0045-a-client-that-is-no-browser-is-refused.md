# 45. A client that is no browser is refused, not only one that says "bot"

Date: 2026-10-24

## Status

Accepted.

## Context

A batch whose user agent contained `bot`, `crawler`, `spider`, `headless` or `lighthouse` was
refused whole: every event answered as rejected with the reason `bot`, nothing stored. The tracker
also stays off while `navigator.webdriver` is true.

On a site Pyxis measures, most visits of its first two weeks were plainly automated: from the
United States with no region, no referrer, a phone's Chrome or Linux, and a long article read
from top to bottom within the same five seconds, every depth marker at once, with no scroll. They
passed both checks. Pyxis stores no user agent, so which clients they were cannot be confirmed
afterwards, but the gap is documented:

- Google lists crawlers whose user agent has no `bot`: `GoogleOther` and `Google-InspectionTool`.
  Their phone versions read as Chrome on Android, with `(compatible; GoogleOther)` at the end.
- The `(compatible; …)` form is how self-declared robots write their user agent (Googlebot,
  bingbot, Applebot, GoogleOther). No current browser sends it; Internet Explorer 10 and older
  did, and the tracker does not run there.
- Clients that are no browser at all (`curl`, HTTP libraries, link previewers) name neither a
  browser engine nor an operating system, and some send no user agent.

## Decision

The ingestion refuses a batch as `bot`, as before, when its user agent:

1. is missing or blank;
2. contains `bot`, `crawler`, `spider`, `headless`, `lighthouse` or `compatible;`, in any case;
3. names neither a browser nor an operating system the classifier knows.

The rules live in `isBotUserAgent` (`src/domain/events/user-agent.ts`), next to the classifier
whose browser and system rules the third one reuses. The answer keeps its shape: `202` with every
event rejected and the reason `bot`.

## Consequences

- The documented crawlers without `bot` in their name, link previewers and scripts are no longer
  counted as visits. Ingestion stays meant for browsers: it already requires an allowed `Origin`.
- A robot that sends a full, ordinary browser user agent still passes. A browser that names no
  known system (some game consoles and embedded browsers) is refused; every phone, computer and
  TV browser names its system.
- Events stored before the change are not reclassified: nothing stored tells them apart.
- Scripts that check production by posting batches must send a browser's user agent.
