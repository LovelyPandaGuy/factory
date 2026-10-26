# Plan: [what changes]

- Spec: `specs/[NNN-name]/spec.md` (approved)
- Date: [YYYY-MM-DD]

## Summary

[The approach in three sentences: what changes, where, and why this way.]

## What already exists, and what is reused

Walk the reuse ladder in the constitution and stop at the first rung that holds.

| Need | Rung | What is used | Why |
|---|---|---|---|
| | already in the repo / standard library / platform / installed package / open source / new code | | |

## Data

[Tables or fields added or changed, every index and what it is for, and what would be
painful to change once real people's data is in it. "No data changes" is an answer.]

## Who can read and write it

[Each thing stored: who can read it, who can write it, and how that is enforced (a server
rule, not only the app). Where any secret lives.]

## Personal data

[What personal data is touched, why, where it is stored and for how long. "None" is an
answer.]

## One check per acceptance check

| Acceptance check | Kind | Command or file |
|---|---|---|
| AC1 | unit / journey / device-only | |

## Files

- `path/to/file`: [what changes]

## Risks

- [What could go wrong, and how the tasks put it first.]

## Constitution check

- [ ] Every state in the spec is answered, or n/a with a reason
- [ ] Every acceptance check has a check above
- [ ] No secret in a file; personal data stated
- [ ] Known traps read; none applies, or the plan says how it is avoided
