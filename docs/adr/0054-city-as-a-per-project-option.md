# 54. The city as a per-project option, off by default

Date: 2026-10-29

## Status

Accepted. Supersedes the city part of
[ADR 0014](0014-store-the-region-never-the-city.md); the region stays as it decided.

## Context

ADR 0014 kept the region and refused the city: on a small site, the city together with the
device, browser, system and time of a visit can point to one person. Since then, site owners
asked for the spread of their audience ("reached five continents and 473 cities"), and the
direct alternatives keep the city: Plausible, Fathom (since July 2025), Umami, PostHog and
Google Analytics 4 all store it, derived from the IP address, which none of them keeps. Only
Simple Analytics, which places visits by time zone, stores no city and no region.

The risk ADR 0014 named has not changed. What changed is who should weigh it: the owner of the
site is the controller of its visitors' data and knows whether the site is small, whether its
visitors are identified, and what its privacy notice says. The contract also promises, today,
that the city is not kept; any change must leave that promise true for whoever does not choose
otherwise.

## Decision

- **A setting of each project, `city_enabled`, false by default** for every project, new or
  existing. The owner changes it in the dashboard (`PATCH /v1/projects/{id}`); the operator's
  projects, which have no owner, change it with `project:update --city-on | --city-off`.
- **Read only when the option is on.** Ingestion does not even look at `CloudFront-Viewer-City`
  for a project that has it off. When on, the name is percent-decoded and checked like the
  region name (shared `decodeHeaderName`), at most 100 characters, and **kept only when the
  region was kept too**: the same city name exists in several regions, and CloudFront sends a
  city but no region for requests from the AWS network, which are automated.
- **Nothing finer, ever:** postal code, metro code, latitude, longitude and time zone stay unread.
- **Turning it off erases.** The reading stops at once in the database; a function instance
  that cached the project (60 seconds) may still store a city during that minute. The daily
  retention job (06:00 UTC) gains a step that sets the city to null, in batches, on every event
  of a project with the option off, using a partial index on the events that hold a city. So a
  city is gone within a day of turning the option off. Projects whose deletion is held keep
  theirs, as they keep their old events.
- **Exports carry it:** the project's CSV export and the copy of an identified person's events
  gain `city`, so what is handed over matches what is kept.

## Consequences

- Nothing changes for any project until its owner turns the option on; the contract's promise
  holds for every project that does not.
- A site that turns it on must say so in its privacy notice; the dashboard says it next to the
  switch, and the terms give a version of the suggested notice with the city.
- City data from an IP address is approximate, worst on mobile networks, which often surface in
  the carrier's gateway city. Reports call it approximate.
- Reports (cities on Devices, the city of a visit, a city filter) and the reach summary
  (continents, countries, regions, cities) are separate changes on top of this one.
