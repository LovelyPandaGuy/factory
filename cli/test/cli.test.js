import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/factory.js", import.meta.url));
const FAKE_KEY = ["sk", "R7kQ2mX9pL4vT8nB3wZ6cF1hJ5sD0aG"].join("-");

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), "factory-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: "utf8" });
}

test("help: explains the commands", (t) => {
  const root = temp(t);
  const result = run(root, "--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /factory verify/);
  assert.match(result.stdout, /factory build/);
  assert.match(result.stdout, /factory spec/);
});

test("factory with no arguments: shows what the project can prove, and writes nothing", (t) => {
  const root = temp(t);
  writeFileSync(join(root, "app.js"), "export const add = (a, b) => a + b;\n");
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /What I see/);
  assert.match(result.stdout, /What this project can prove right now/);
  assert.match(result.stdout, /Secrets in code/);
  assert.match(result.stdout, /factory "what you want to change"/);
  assert.deepEqual(readdirSync(root), ["app.js"], "the first run must not write into the project");
});

test("factory with no arguments: a real credential exits 1", (t) => {
  const root = temp(t);
  writeFileSync(join(root, "config.js"), `const key = "${FAKE_KEY}";\n`);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /NOT DONE/);
});

test("factory with no arguments: an empty folder says so", (t) => {
  const root = temp(t);
  const result = run(root);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No project found here/);
});

test("factory with no arguments: an unapproved spec is pointed out", (t) => {
  const root = temp(t);
  mkdirSync(join(root, "specs", "001-booking"), { recursive: true });
  writeFileSync(join(root, "specs", "001-booking", "spec.md"), "# Spec\n\nA booking is written.\n");
  writeFileSync(join(root, "factory.config.json"), JSON.stringify({ name: "Demo", spec: { active: "001-booking" } }));
  const result = run(root);
  assert.match(result.stdout, /001-booking is waiting for your approval/);
});

test("factory \"a job\": is treated as the start, and needs a terminal to approve", (t) => {
  const root = temp(t);
  const result = run(root, "add a booking form");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /needs a terminal/);
});

test("version: read from package.json", (t) => {
  const root = temp(t);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(run(root, "--version").stdout.trim(), `factory ${pkg.version}`);
});

test("verify: without a config it writes nothing", (t) => {
  const root = temp(t);
  writeFileSync(join(root, "app.js"), "1;\n");
  const result = run(root, "verify");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(join(root, ".factory")));
});

test("verify --json: clean project passes with all eight checks", (t) => {
  const root = temp(t);
  writeFileSync(join(root, "app.js"), "export const add = (a, b) => a + b;\n");
  const result = run(root, "verify", "--json");
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.ok, true);
  assert.equal(json.results.length, 8);
});

test("verify: a planted secret exits 1", (t) => {
  const root = temp(t);
  writeFileSync(join(root, "config.js"), `const key = "${FAKE_KEY}";\n`);
  const result = run(root, "verify");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /NOT DONE/);
});

test("init --yes: writes a config from the flags", (t) => {
  const root = temp(t);
  const result = run(root, "init", "--yes", "--name=Demo", "--kind=web", "--data=yes");
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(readFileSync(join(root, "factory.config.json"), "utf8"));
  assert.equal(config.name, "Demo");
  assert.equal(config.kind, "web");
});

test("build --print: prints the prompt and writes nothing", (t) => {
  const root = temp(t);
  const result = run(root, "build", "add a booking form", "--print");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## The job/);
  assert.match(result.stdout, /add a booking form/);
  assert.deepEqual(readdirSync(root), []);
});

test("build: without an agent it saves the prompt and exits 2", (t) => {
  const root = temp(t);
  writeFileSync(
    join(root, "factory.config.json"),
    JSON.stringify({
      name: "Demo",
      kind: "web",
      agent: { command: "definitely-not-a-real-agent-xyz", args: ["-p", "{prompt}"] },
    }),
  );
  const result = run(root, "build", "add a form", "--hotfix");
  assert.equal(result.status, 2);
  assert.match(result.stdout, /No agent found/);
  assert.ok(readdirSync(join(root, ".factory", "prompts")).length > 0);
});

test("build: without a spec it refuses, and says why", (t) => {
  const root = temp(t);
  const result = run(root, "build", "add a form");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No active spec/);
  assert.match(result.stderr, /--hotfix/);
});

test("spec --print: the factory's own template, the numbered path, and nothing written", (t) => {
  const root = temp(t);
  const result = run(root, "spec", "add a booking form", "--print");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /specs\/001-add-a-booking-form\/spec\.md/);
  assert.match(result.stdout, /## States/);
  assert.match(result.stdout, /## Acceptance checks/);
  assert.match(result.stdout, /Assumed:/);
  assert.match(result.stdout, /Do not ask the person anything now/);
  assert.match(result.stdout, /What the repo already shows/);
  assert.doesNotMatch(result.stdout, /Tests are OPTIONAL/i);
  assert.deepEqual(readdirSync(root), []);
});

test("spec --approve: records a fingerprint and goes stale after an edit", (t) => {
  const root = temp(t);
  const dir = join(root, "specs", "001-booking");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), "# Spec\n\nA booking is written and can be read back.\n");

  const approved = run(root, "spec", "--approve", "001-booking", "--by=Tester");
  assert.equal(approved.status, 0, approved.stderr);
  assert.match(approved.stdout, /Approved: 001-booking/);
  assert.ok(existsSync(join(dir, "approval.json")));

  const status = run(root, "status");
  assert.match(status.stdout, /approved/);

  writeFileSync(join(dir, "spec.md"), "# Spec\n\nChanged after approval.\n");
  const stale = run(root, "status");
  assert.match(stale.stdout, /stale/);
});

test("lesson new: writes a file with the required fields", (t) => {
  const root = temp(t);
  const result = run(
    root,
    "lesson", "new",
    "--title=Saved but not saved",
    "--what=The toast said saved.",
    "--check=Reload and read it back.",
  );
  assert.equal(result.status, 0, result.stderr);
  const files = readdirSync(join(root, "lessons")).filter((file) => file !== "_template.md");
  assert.equal(files.length, 1);
  const text = readFileSync(join(root, "lessons", files[0]), "utf8");
  assert.match(text, /Saved but not saved/);
});

test("unknown command: exits 1", (t) => {
  const root = temp(t);
  const result = run(root, "nope");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command/);
});

test("doctor: names the checks", (t) => {
  const root = temp(t);
  const result = run(root, "doctor");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /secrets/);
  assert.match(result.stdout, /personal/);
});
