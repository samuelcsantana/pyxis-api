# 1. Record architecture decisions

Date: 2026-10-05

## Status

Accepted

## Context

This repository forbids comments in code. The reasoning behind a design choice still has to live
somewhere a reader of the public repository can find it, and a commit message is hard to discover
once more commits pile on top.

## Decision

Significant architecture decisions are recorded as short documents in `docs/adr/`, numbered in
order (`0001-short-title.md`), each with context, decision and consequences. A decision that is
replaced keeps its file, marked as superseded, and links to the new one.

## Consequences

- The README's ADR index is the entry point for "why is it built this way".
- Smaller choices stay in commit bodies and pull request descriptions.
- ADRs never contain private plans, product numbers or data about any user.
