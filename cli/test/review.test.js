import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewCommand } from "../lib/commands.js";
import { changeSince, parseReview, reviewBase, reviewPassed, workingTreeFingerprint } from "../lib/review.js";

const REVIEW = `# Review

| # | Severity | Where | Rule | What is wrong | How to prove it |
|---|---|---|---|---|---|
| 1 | must fix | src/a.ts:12 | R5 | B can read A's rows | sign in as B |
| 2 | should fix | src/b.ts:3 | R3 | no empty state | open with no data |

## Acceptance checks

| Check | Verdict | Evidence |
|---|---|---|
| AC1 | PASS | test "stores it" fails when reverted |
| AC2 | FAIL | the header is never set |
| AC3 | UNPROVEN | needs a real phone |

Missing: AC4 cancel online
Extra: none

VERDICT: send back
`;

test("parse: findings, per-check verdicts, missing and the verdict line", () => {
  const review = parseReview(REVIEW);
  assert.equal(review.verdict, "send back");
  assert.equal(review.mustFix.length, 1);
  assert.equal(review.mustFix[0].where, "src/a.ts:12");
  assert.equal(review.shouldFix.length, 1);
  assert.deepEqual(review.proven.map((c) => c.check), ["AC1"]);
  assert.deepEqual(review.failed.map((c) => c.check), ["AC2"]);
  assert.deepEqual(review.unproven.map((c) => c.check), ["AC3"]);
  assert.deepEqual(review.missing, ["AC4 cancel online"]);
  assert.deepEqual(review.extra, []);
  assert.equal(reviewPassed(review), false);
});

test("parse: no verdict line, no review", () => {
  assert.equal(parseReview("Looks good to me!").verdict, null);
  assert.equal(reviewPassed(parseReview("Looks good to me!")), false);
});

test("parse: 'approve' with a must-fix finding still does not pass", () => {
  assert.equal(reviewPassed(parseReview(REVIEW.replace("VERDICT: send back", "VERDICT: approve"))), false);
});

function repo(t) {
  const root = mkdtempSync(join(tmpdir(), "factory-review-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  writeFileSync(join(root, "a.js"), "1;\n");
  git("add", "-A");
  git("-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-qm", "start");
  return { root, git };
}

test("change: tracked edits and new files since the base, without the factory's own records", (t) => {
  const { root, git } = repo(t);
  const base = git("rev-parse", "HEAD").stdout.trim();
  writeFileSync(join(root, "a.js"), "2;\n");
  writeFileSync(join(root, "b.js"), "new;\n");
  const change = changeSince(root, base);
  assert.deepEqual(change.files.sort(), ["a.js", "b.js"]);
  assert.match(change.text, /\+2;/);
  assert.match(change.text, /b\.js {2}\(new file\)/);
  assert.equal(reviewBase(root, { base: "HEAD" }), base);
});

test("fingerprint: changes when a changed file changes, not otherwise", (t) => {
  const { root } = repo(t);
  writeFileSync(join(root, "a.js"), "2;\n");
  const before = workingTreeFingerprint(root);
  assert.equal(workingTreeFingerprint(root), before);
  writeFileSync(join(root, "a.js"), "3;\n");
  assert.notEqual(workingTreeFingerprint(root), before);
});

test("factory review: needs git", (t) => {
  const root = mkdtempSync(join(tmpdir(), "factory-review-nogit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(reviewCommand(root, {}), 1);
});
