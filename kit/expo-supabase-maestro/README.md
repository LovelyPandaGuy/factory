# Kit: journey tests for an Expo + Supabase app (Maestro)

Taken from a client app run (October 2026), where it took 33 user journeys to
passing on real data. Copy it into a new app instead of building test setup from
scratch. The scripts come from that app; adapt the table names and the "people" to
the new app.

## What's here

| File | What it does |
|---|---|
| `scripts/seed-test-accounts.mjs` | Creates "(Test)" accounts through the public API (needs email auto-confirm), puts them far from real users, and resets their invites and chats. `SET=phone` makes a separate set for testing by hand |
| `scripts/e2e.sh` | Runs every flow on the iOS simulator, **resetting test data before each one**, and writes a pass/fail summary |
| `scripts/test-responder.mjs` | Plays "the other person" during a flow (accepts invites) |
| `scripts/phone-responder.mjs` | Test people accept your invites and reply to your messages while you test by hand |
| `scripts/move-test-people.mjs` | Moves test people next to a phone for hands-on testing, and back |
| `scripts/check-storage.mjs` | Live storage check: every upload type the app sends is accepted, and a second account cannot overwrite or delete someone's files |
| `scripts/check-push-devices.mjs` | Live push check: when a second account signs in on a phone that was never signed out, the phone gets the new account's notifications, not the old one's |
| `scripts/check-migrations.mjs` | Is a migration really live? Lists the functions, policies, added columns and dropped policies a migration file creates and checks each against the live database (`supabase db query --linked`, read-only). Also checks a re-created policy calls the new function, because a policy with the same name proves nothing. Exit 1 blocks the release |
| `scripts/lint-outcome-flows.mjs` | Flags flows in `.maestro/flows/` that tap a mutating action (Send, Block, Delete...) and then check only a screen title, or nothing |
| `TWO-ACCOUNT.md` | How to check what the **other** account sees after each action and setting, and how fast |
| `maestro/_setup.yaml` | Shared start: relaunch without wiping, wait for a settled screen, sign in only if needed, close dev-only banners, undo state an earlier flow left |
| `maestro/subflows/sign_in.yaml`, `sign_out.yaml` | Sign in and out, including iOS's "Save Password?" prompt |
| `maestro/S1_signout_isolation.yaml` | Two people on one phone: the second inherits nothing from the first |

## Set-up checklist (each item cost time once)

1. Confirm email auto-confirm is on (`GET /auth/v1/settings`), or test accounts can't sign in.
2. Ask the owner before creating test accounts in a live project. Name them "(Test)",
   place them where no real user is, keep passwords in an untracked file.
3. Use a **development build made with the same Xcode as production**. Local builds
   with a newer Xcode can crash on the newest iOS (seen in the pilot).
4. Start the dev server fresh before a long run; background processes stop at their
   time limit.
5. Location writes may have anti-spoofing rules: re-seeding restarts the clock, so
   don't re-seed right before moving people elsewhere.
6. Proximity apps hide people not seen recently (the pilot app: 2 hours). Keep test
   people
   fresh during hands-on testing; `phone-responder.mjs` re-sends their spot every 20 minutes.
7. Match names by prefix (`"Alex Mokoena.*"`): test people's names end in "(Test)".
8. Every new flow begins from a known account and known settings, never from whatever
   the last flow left.
9. When a flow fails, classify it as app or test with a screenshot and the app log
   before fixing anything.
10. Before a store release, run `check-migrations.mjs` on every migration the release
    needs. If one fails, the release waits (constitution, Release gate). If the CLI says
    the project is not linked, pass the ref: `SUPABASE_QUERY_ARGS="--project-ref <ref>"`.
11. Run `lint-outcome-flows.mjs` with the unit tests. A flagged flow gets an outcome
    check (an item in a list, a `runScript` as the other account), or a `# outcome`
    comment above a check that really is one.

## Recommended CI steps

Add these to the app's CI next to type check and tests.

**Outcome lint for journey flows** (no install needed):

```yaml
      - name: Flows end with an outcome
        working-directory: apps/native
        run: node scripts/lint-outcome-flows.mjs
```

**Cognitive complexity, changed files only.** Turning the rule on for the whole repo
fails on old code nobody is touching (the pilot had 25 files over the limit).
Checking only
the files a change touches stops it getting worse, and each file is fixed when it is
next worked on. Put a small config next to the main one, so the rest of the lint
settings stay as they are:

```jsonc
// ci/biome-complexity.json (in the folder that holds biome.json, or below it)
{
  "root": false,
  "extends": "//",
  "linter": { "rules": { "complexity": {
    "noExcessiveCognitiveComplexity": { "level": "error", "options": { "maxAllowedComplexity": 15 } }
  } } }
}
```

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0            # --since needs the base branch's history
      - name: No new complex functions in changed files
        run: >
          npx biome lint --config-path=ci/biome-complexity.json
          --changed --since=origin/${{ github.base_ref || 'main' }}
          --no-errors-on-unmatched
```

The main config must have `vcs.enabled: true` and `vcs.clientKind: "git"`. Checked with
Biome 2.3.8 on 2026-10-12: a changed file over the limit fails, untouched files are not
read, and a change with no matching files passes because of `--no-errors-on-unmatched`.
