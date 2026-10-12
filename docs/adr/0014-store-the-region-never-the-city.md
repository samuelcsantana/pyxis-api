# 14. Store the viewer's region, never the city

Date: 2026-10-12

## Status

Accepted. Extends [ADR 0006](0006-lambda-behind-cloudfront.md) (CloudFront in front of the API,
which already forwards its viewer location headers).

## Context

Each event kept only the viewer's country, from `CloudFront-Viewer-Country`. Site owners asked
where in the country their visitors are. CloudFront works out, from the same address and at the
same moment, the first-level subdivision of the country (a state in Brazil or the United States,
a province in Canada, an autonomous community in Spain), the city, the postal code and the
coordinates, and sends each in its own header at no extra cost. The origin request policy
(`allExcept: Host`) already forwards all of them; the API read only the country.

Pyxis is meant for small sites, where a few dozen visits a day is normal. On such a site, the
city together with the device, browser, system and time of a visit can point to one person, which
breaks the promise that events carry no personal data. A region is broad enough not to: millions
of people share it. City-level data from an IP address is also unreliable in Brazil, where mobile
networks often surface in the city that hosts the carrier's gateway.

## Decision

- **Kept:** the region code, as the full ISO 3166-2 code with its country in front (`BR-SP`),
  because the same subdivision code exists in more than one country; and the region's name as
  CloudFront sends it (`São Paulo`), so a dashboard can show any country's regions without a
  table of its own. Both only when the country itself was kept.
- **Never read:** `CloudFront-Viewer-City`, `-Postal-Code`, `-Metro-Code`, `-Latitude`,
  `-Longitude`. A test sends the city and checks it is nowhere in the stored row.
- **Validated like any input at the edge:** the code must be one to three letters or digits; the
  percent-encoded name is decoded without throwing and dropped when it is not printable ASCII
  before decoding, holds an invalid UTF-8 sequence or a control character, is blank or is longer
  than 64 characters. A bad name never costs the code.
- **Reports:** Devices lists the ten regions with most visits, then "other", then the visits
  without a region apart, so they do not inflate "other"; Visits and Timeline show the region of
  each visit, taken from its first event like the country; Visits filters by region; the export of
  a person's events carries it.

## Consequences

- Events stored before this change, and addresses CloudFront cannot place, have a null region.
  For as long as old events are kept, Devices shows a "no region" row.
- CloudFront does not set the region for requests that come from AWS's own network, so a load
  test run from AWS stores none.
- Sites that measure with Pyxis describe the region in their privacy policies; the city stays out
  of them because it is never collected.
- The visit-level region still adds a little to what a single visit reveals. That is accepted for
  a region; it is the reason the city was refused.
