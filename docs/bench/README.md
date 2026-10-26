# Bench: replaying solved problems

How we test the factory. Take an open-source issue that maintainers have already fixed,
wind the project back to just before the fix, and let the factory solve it from the issue
text alone. Then score it with the maintainers' own tests, which the factory never sees.

## Method

1. **Pick** issues fixed after the model's training cutoff (so the answer can't be
   remembered), in repos with fast test suites and a permissive licence, where the fix PR
   adds tests. Mix languages and kinds of software.
2. **Prepare** each task: clone at the fix's parent commit, then delete `.git` and commit a
   single snapshot, so the future fix is not in the history. Split the real PR into
   `hidden-tests.patch` and `real-fix.patch`, stored outside the task folder.
3. **Check the scorer**: hidden tests must fail on the snapshot and pass with the real fix.
4. **Build**: a builder agent gets the issue and the factory's build rules only.
5. **Review**: a separate agent, fresh session, reviews against the factory's review rules.
6. **Score**: keep the builder's source changes, replace its tests with the hidden tests,
   run them. Compare the fix with the real one. Record time, verdict, misses.
7. **Learn**: every miss becomes a rule, then the failed step is re-run to prove the rule
   works.

Nothing is sent to the projects. All work happens in local copies.

## Runs

| Run | Date | Tasks | Solved (hidden tests) | Reviewer approved | Notes |
|---|---|---|---|---|---|
| [Pilot 1](runs/2026-10-09-pilot.md) | 2026-10-09 | 3 | 2 of 3 fully, 1 partly | 3 of 3 | Builder and reviewer both missed a second copy of the bug; rule R7 added and the re-run reviewer found it |
