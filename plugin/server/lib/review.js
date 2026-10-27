import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIFF_LIMIT = 200 * 1024;
// The reviewer's own output and the factory's records are not part of the change.
const IGNORE = [":(exclude).factory", ":(exclude,glob)specs/*/evidence/**"];

function git(root, args) {
  const run = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : null;
}

export function isGitRepo(root) {
  return git(root, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

// Where the change starts: --base, then the commit the build started on, then where this
// branch left main.
export function reviewBase(root, { base, state } = {}) {
  if (base) return git(root, ["rev-parse", "--verify", `${base}^{commit}`])?.trim() ?? null;
  if (state?.buildBase && git(root, ["cat-file", "-e", `${state.buildBase}^{commit}`]) !== null) return state.buildBase;
  for (const main of ["origin/main", "main", "origin/master", "master"]) {
    const found = git(root, ["merge-base", "HEAD", main])?.trim();
    if (found) return found;
  }
  return git(root, ["rev-parse", "HEAD"])?.trim() ?? null;
}

function untracked(root) {
  return (git(root, ["ls-files", "--others", "--exclude-standard", "--", ".", ...IGNORE]) ?? "")
    .split("\n")
    .filter(Boolean);
}

// The change as the reviewer sees it: tracked changes since base, plus new files. Too big
// to paste, and the reviewer gets the list of files to read itself.
export function changeSince(root, base) {
  const stat = git(root, ["diff", "--stat", base, "--", ".", ...IGNORE]) ?? "";
  const diff = git(root, ["diff", base, "--", ".", ...IGNORE]) ?? "";
  const added = untracked(root);
  let text = diff;
  for (const file of added) {
    let body = "";
    try {
      body = readFileSync(join(root, file), "utf8");
    } catch {}
    if (body.includes("\u0000")) continue;
    text += `\n--- /dev/null\n+++ b/${file}  (new file)\n${body}`;
  }
  const files = [
    ...(git(root, ["diff", "--name-only", base, "--", ".", ...IGNORE]) ?? "").split("\n").filter(Boolean),
    ...added,
  ];
  if (text.length > DIFF_LIMIT) {
    return { stat, files, text: null, truncated: true };
  }
  return { stat, files, text, truncated: false };
}

// A fingerprint of every changed and new file, so the factory can tell whether the
// reviewer touched anything beyond its own review file.
export function workingTreeFingerprint(root) {
  const hash = createHash("sha256");
  const changed = (git(root, ["status", "--porcelain", "--untracked-files=all", "--", ".", ...IGNORE]) ?? "")
    .split("\n")
    .filter(Boolean)
    .sort();
  for (const line of changed) {
    const file = line.slice(3).split(" -> ").pop();
    hash.update(line);
    try {
      hash.update(readFileSync(join(root, file)));
    } catch {
      hash.update("<gone>");
    }
  }
  return hash.digest("hex");
}

function tableRows(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

// Reads review.md. Anything unexpected counts against the change: no verdict line means
// no review.
export function parseReview(text) {
  const body = String(text ?? "");
  const verdictLine = body.match(/^\s*VERDICT:\s*(approve|send back)\s*$/im);
  const [findingsPart, checksPart = ""] = body.split(/^##\s+Acceptance checks\s*$/im);

  const findings = tableRows(findingsPart)
    .filter((cells) => cells.length >= 5 && !/^#$/.test(cells[0]))
    .map(([, severity, where, rule, what, how = ""]) => ({
      severity: severity.toLowerCase(),
      where,
      rule,
      what,
      how,
    }));

  const checks = tableRows(checksPart)
    .filter((cells) => cells.length >= 3 && !/^check$/i.test(cells[0]))
    .map(([check, verdict, evidence]) => ({ check, verdict: verdict.toUpperCase(), evidence }));

  const listed = (name) => {
    const match = checksPart.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "im"));
    const value = match?.[1]?.trim() ?? "";
    return !value || /^none\.?$/i.test(value) ? [] : [value];
  };

  return {
    verdict: verdictLine ? verdictLine[1].toLowerCase() : null,
    findings,
    mustFix: findings.filter((finding) => finding.severity === "must fix"),
    shouldFix: findings.filter((finding) => finding.severity === "should fix"),
    checks,
    failed: checks.filter((check) => check.verdict === "FAIL"),
    unproven: checks.filter((check) => check.verdict === "UNPROVEN"),
    proven: checks.filter((check) => check.verdict === "PASS"),
    missing: listed("Missing"),
    extra: listed("Extra"),
  };
}

// The tool decides, not the reviewer's last line alone: any must-fix, FAIL or missing
// check sends it back even if the verdict says approve.
export function reviewPassed(review) {
  return (
    review.verdict === "approve" && !review.mustFix.length && !review.failed.length && !review.missing.length
  );
}

export function reviewLine(review) {
  const parts = [`${review.mustFix.length} must fix`, `${review.shouldFix.length} should fix`];
  if (review.checks.length) {
    parts.push(`acceptance checks ${review.proven.length} of ${review.checks.length} proven`);
    if (review.unproven.length) parts.push(`${review.unproven.length} for a person to check`);
  }
  return `${reviewPassed(review) ? "approved" : "sent back"} by a separate session: ${parts.join(", ")}`;
}
