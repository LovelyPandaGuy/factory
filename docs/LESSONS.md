# Lessons

What each run of the factory taught it. Newest first. Each lesson points to where it
now lives (a rule, a known trap, or the kit), so the next run starts with it.

## Run 3: building 0.3.0 with the factory's own method (2026-10-24)

**What happened:** the tool was made ready for outside engineers and tested on four real
projects and in five end-to-end runs with Claude Code. Each run found something the unit
tests had not.

| # | What happened | Now lives in |
|---|---|---|
| 31 | The first run reported 4 credentials in a client app and 5 in a Python tool; 8 of the 9 were fake test values, a local database string or a line of prose. A first run that cries wolf loses the reader | Secrets split into a proven row and a flagged "possible test passwords" row; tests from those exact lines |
| 32 | The builder may edit files but not run commands, and the spec demanded a staged file and evidence made by running commands. The reviewer rightly sent it back twice, and "done" was unreachable | Specs prove things with tests and the factory's checks; the factory records evidence; committing is the person's job; UNPROVEN for what needs a command nobody ran |
| 33 | A person's own dev server was already on localhost:3000. The factory used the first address that answered, and the tester checked the old code (and said so) | The app under test gets its own free port; an address that answered before it started is refused |
| 34 | On Windows, agents installed by npm are `.cmd` files and live under `C:\Program Files`; the agent could not be started | `.exe` starts directly, `.cmd` through the shell with its path quoted; caught by CI on Windows |

**Also:** a test command that could not start (no pytest on the machine) used to be a
failure; it is now "not run" with the reason.

## Run 1 addendum (2026-10-12): issues found by testers after 2.1.0

**What happened:** Release 2.1.0 of the pilot app (spec 001) went to the App Store with 32 of 33
journeys passing. Testers on their own phones then found 12 problems. None was a crash; most were
things any chat app does, or things the other person sees. The work is spec 003.

**Root causes:** no product baseline (nobody listed what a chat app is expected to do);
tests asserted screens, not outcomes, and never looked from the other account; every
test ran on a simulator, with no real-phone or outside-tester gate; a server migration
was never tied to the release; nobody defined what each setting means for other people.

| # | What testers found | Cause | Now lives in |
|---|---|---|---|
| 19 | Blocking was one-sided: the blocked person could still message and invite; the block list missed a block the server had | The database rule was written (migration) but never applied; the app only checked its own side; no test looked from the blocked account | Known traps (migration not applied); Release gate 1; kit `check-migrations.mjs`, `TWO-ACCOUNT.md`; VII "Other person" |
| 20 | Turning off "show online status" was saved only on the phone: others still saw you, and it hid **their** status from you instead | Setting meaning never defined; stored on the device | VII "Setting semantics"; X (Settings row) |
| 21 | Chat photos were force-cropped, and tapping a photo did nothing | Picker forced an edit step and the bubble cut photos to a fixed box; no baseline row for "photo full screen" | X (Chat row); VIII device-only list (photo picker) |
| 22 | No way to type a new line in a chat | Not in any spec; no baseline | X (Chat row) |
| 23 | No unsend or delete for messages, a "Reply" menu item that did nothing, no typing indicator | Not in any spec; a menu item was shown with no handler | X (Chat row); Known traps (button that does nothing) |
| 24 | Voice notes listed under shared media | No baseline for what shared media holds | X (Chat row) |
| 25 | Sign-up felt bad: name and surname asked again after Google gave them, birthday typed by hand, forced photo crops | No baseline for sign-up | X (Sign-up row) |
| 26 | Splash text cut off on phones, after a "fix" had shipped | The fix was checked on the simulator only | Known traps (fix without device check); VIII device-only list (splash on smallest phone) |
| 27 | Radar heading cone jittered, lagged and spun the long way round past north | Compass behaviour only checkable on a phone; never on the list | VIII device-only list (compass) |
| 28 | A friend's new profile pictures showed, then disappeared for viewers | Another person's data cached for 24 hours (`offlineFirst`) | Known traps (long cache on another person's data); `TWO-ACCOUNT.md` (caches) |
| 29 | Before matching, only one profile photo; no gallery | No baseline for profiles | X (Profiles row) |
| 30 | Complexity lint failed on 25 files, and stacked pull requests were merged in a confusing order (#29 already contained #28) | No complexity limit on changed code; stacked PRs targeted `main` and did not state their base | Workflow (PR rule, complexity in CI); kit README CI recipe |

**Also added:** a flow that taps a mutating action must end with an outcome assertion
(VIII; kit `lint-outcome-flows.mjs`, which flagged 4 of the 33 flows on its first run).

## Run 2: Bench pilot, replaying 3 solved open-source issues (2026-10-09)

**Outcome:** 2 of 3 fully solved against the maintainers' hidden tests, 1 partly (2 of 495
tests failed). Builders took 5 to 8 minutes each; every reviewer approved. Details:
`bench/runs/2026-10-09-pilot.md`.

| # | What happened | Now lives in |
|---|---|---|
| 17 | Builder fixed the reported bug but not an identical copy in a sibling type; the reviewer, told to read changed lines only, approved it | Known traps; review rule R7. A re-run reviewer with R7 found the copy |
| 18 | A real fix also updated user docs; the builder didn't check docs | Bench lessons; to add to the build rules |

## Run 1: a client chat app, spec 001 "phone-ready release" (2026-10-06 to 07)

**Outcome:** 45 of 47 audit problems fixed; 32 of 33 user journeys passing on real
data; unit tests 35 to 66. Owner on the phone: "faster with almost no errors".

### What worked
- **Checking the audit against current code first.** A quarter of the 147 findings
  were already fixed; effort went only to what was still real.
- **Reuse before building.** Nearly every fix reused code the app already had.
- **Designing the ten states in the spec.** Loading, offline, dark mode, double tap and
  back were planned, not discovered.
- **Journey tests on real data.** They caught the bugs that also made the app slow:
  a chat-screen freeze, a sign-out freeze, contacts under "U".
- **Parallel helpers** for read-only checking (audit triage, research) saved hours.

### What went wrong, and what changed

| # | What happened | Cost | Now lives in |
|---|---|---|---|
| 1 | The test branch's demo-data layer rewrote real code; porting it would have hidden bugs | Plan rework | Rule VIII |
| 2 | About half of all journey failures were the tests: name labels, iOS prompts, leftover state | Several reruns | Rule VIII, kit checklist |
| 3 | A paused account and a leftover second sign-in leaked into later flows | False alarms (one looked like a privacy leak) | Rule VIII, kit `_setup.yaml` |
| 4 | Sign-out cleanup inside Supabase's auth callback froze the app | Found late, by a new test | Known traps |
| 5 | New stores created on every render froze the chat screen | Three runs of noise | Known traps |
| 6 | Live database didn't match the repo's migrations | Would have broken a migration | Rule VIII |
| 7 | Nearby search had no distance limit (privacy) | Found by accident | Known traps, rule III review |
| 8 | Local Xcode 27 build crashed on iOS 27 | Hour of build work | Kit checklist |
| 9 | Dev server stopped at its 2-hour limit mid-run | Two failed journeys | Known traps, kit checklist |
| 10 | Told the owner what the radar would show without checking their account | Frustration at 2am | Rule VIII (check before promising) |
| 12 | Shipped an OTA update without checking it against the App Store build: a native package added in August crashed it on launch, and it rolled back (the August update had done the same, silently, for weeks) | Release pulled; needs a new store build | Known traps |
| 13 | Voice notes never worked: the storage bucket rejected audio; the journey test only checked that "Sending…" appeared. The same probe found anyone could overwrite anyone's files | Feature broken since launch; live security hole | Known traps; kit check-storage |
| 14 | Found by the owner after release: notifications not arriving in testing, intro text cut off on first launch | Trust | Rule VIII: outcome asserts, real-behaving helpers, device-only list |
| 15 | Owner reported "notifications go to my own user". A phone could belong to one account only and the store app never removed it on sign-out, so switching accounts failed silently and the phone kept the old account's pushes. No test signed two accounts into one phone and checked where the push went | Confusing bug in live; owner had to find it | Known traps; kit check-push-devices |
| 16 | Store builds 42 to 45 went to Apple with no git tag; the team couldn't tell which code was live | Team complaint | Constitution Workflow: tag every store build |
| 11 | Journey runs were slow (minutes per flow), baseline abandoned halfway | Hours | Open: speed up runs (below) |

### Still open (next improvements to the factory)
- **Faster journey runs:** run only the journeys a change touches; full runs nightly.
- **Run journeys in CI**, not just on one Mac.
- **A black-screen-at-launch detector** (one unexplained black screen at launch is still open).
- **A "hand-off" step** before any person tests: confirm account, location, server and
  test data on their device first.
