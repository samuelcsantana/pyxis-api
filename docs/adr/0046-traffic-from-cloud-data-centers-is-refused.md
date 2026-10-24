# 46. Traffic from cloud data centers is refused

Date: 2026-10-24

## Status

Accepted. Follows [ADR 0045](0045-a-client-that-is-no-browser-is-refused.md), which refuses
clients by their user agent.

## Context

ADR 0045 catches robots that say what they are. A robot that copies a full browser user agent
still passes, and the automated visits that led to it looked like that: a phone's Chrome or a Linux
desktop, from the United States, with no region. CloudFront sets no region for requests from AWS's
own network, and rendering services, link previewers and scrapers run on cloud servers, not on the
phone and home networks people browse from.

CloudFront tells the function which network each request came from, as an autonomous system
number in `CloudFront-Viewer-ASN`, derived from the address the same way the country and the region
are. The number names an organization (Amazon, Google, a mobile carrier), never a person.

## Decision

- The ingestion reads `CloudFront-Viewer-ASN` and refuses the whole batch when the number belongs
  to a fixed list of cloud and hosting providers: Amazon, Google and Google Cloud, Microsoft, Oracle
  Cloud, DigitalOcean, OVH, Hetzner, Akamai Connected Cloud (Linode), Vultr, Scaleway, Alibaba
  Cloud, Tencent Cloud and Contabo. The list is `DATA_CENTER_NETWORKS`
  (`src/domain/events/data-center-networks.ts`), checked after the user agent.
- The answer is the bot's: `202` with every event rejected, nothing stored. The rejection is logged
  with the reason `data_center`, and one line per refused batch (`ingest.data_center_refused`)
  names the project, the network number and its operator, so the effect can be measured.
- Left out on purpose: Cloudflare, Akamai's content network and Fastly, through which privacy
  relays (iCloud Private Relay, Cloudflare WARP) carry real people, and every carrier and home
  provider. A missing or malformed header refuses nothing.
- The number is used while the request is handled and never stored, like the address it comes
  from. `client_ip.sources`, logged once per execution environment, now says whether the header
  arrived, never its value.

## Consequences

- Visits rendered or fetched from the listed clouds stop counting, whatever their user agent.
- A person who browses through a server of their own in one of those clouds, or a remote desktop
  hosted there, is not counted. That is the trade this decision makes.
- Events stored before the change are not reclassified.
- A check that posts batches to production from a cloud machine (a CI runner, a Lambda) is refused;
  send it from a home or mobile network.
- The list is reviewed when the refusal log shows a network worth adding, or a provider whose
  network serves people.
