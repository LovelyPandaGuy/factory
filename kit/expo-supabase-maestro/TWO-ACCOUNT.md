# Two-account checks

Most bugs testers find after a release are about **the other person**: you blocked
someone and they can still message you; you turned off "show online status" and they
still see you online; you changed your photo and your friend still sees the old one.
A test with one account cannot see any of these. This guide is how every spec answers
the "Other person" and "Setting semantics" states (constitution VII).

## The rule

For every action and every setting, the spec names:

1. **What the other account sees**, in words ("B no longer sees A on the radar").
2. **How fast** ("within 10 seconds while B has the chat open"; "next time B opens
   the profile").
3. **Where it is stored** (server or this phone) and **who it affects** (me, them,
   everyone).
4. **The check**, run from the other account, not the one that acted.

If (3) says "this phone" but (1) says the other person is affected, the design is
wrong: a setting that changes what others see must live on the server.

## Accounts

Use the test accounts from `scripts/seed-test-accounts.mjs` (names end in "(Test)",
passwords only in the untracked `.maestro/.phone-accounts.env`). Call them A and B in
specs and flows. Never use real people's accounts.

## Three ways to run a check, cheapest first

| Way | When | How |
|---|---|---|
| Script as B | The outcome is data: a row exists, a read is refused, a field changed | A Node script signs in as B with `@supabase/supabase-js` and makes the **same call the app makes** (`check-storage.mjs` is the pattern). Exit 0 or 1 |
| Flow as A, script as B | A taps in the app; B's view is data | The Maestro flow ends with `runScript` (or a shell step after it) that runs the B script. This is the outcome assertion the lint asks for |
| Two devices | The outcome is only visible on screen (typing dots, a cone, a push) | Simulator signed in as A, a second simulator or a phone as B. Record both screens; save the recording in `evidence/` |

## The checklist per action

| Action by A | Check as B |
|---|---|
| Block B | B cannot send a message, start a chat or send an invite to A (the server refuses, not only A's app); A is not on B's radar; no push reaches A |
| Unblock B | B can message again; A sees B in lists again; A's blocked list no longer shows B |
| Turn off a visibility setting (online status, location, read receipts) | B's read of A's data returns nothing for that field, from a fresh install of B (no cache) |
| Change profile photo or gallery | B opening A's profile sees the new photo within the stated time, also after B had the old one cached |
| Delete or unsend a message | B's chat loses it (or shows "deleted") within the stated time, with the chat open and after reopening |
| Typing | B sees the indicator within about a second, and it goes away when A stops |

## Timing

Write the time limit into the check ("within 10 s"), poll until then, and fail after.
Never "wait 30 s and look": a fixed sleep hides a slow path and makes runs slow.

## Caches

If B's app caches A's data (TanStack Query `offlineFirst`, a persisted cache, MMKV),
the check must run **after** B has the old value cached. That is the case real users
hit; a fresh B passes even when the cache is wrong (constitution, Known traps).
