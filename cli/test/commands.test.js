import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { init, lessonNew, report } from "../lib/commands.js";
import { readConfig } from "../lib/config.js";
import { verify } from "../lib/verify.js";

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), "factory-cmd-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("init: writes config, rules and roles", async (t) => {
  const root = temp(t);
  const code = await init(root, {
    yes: true,
    name: "Demo",
    kind: "web",
    who: "client, funder",
    data: "yes",
  });
  assert.equal(code, 0);

  const config = readConfig(root);
  assert.equal(config.name, "Demo");
  assert.equal(config.kind, "web");
  assert.deepEqual(config.whoDepends, ["client", "funder"]);
  assert.equal(config.personalData, "yes");

  assert.ok(existsSync(join(root, "factory.config.json")));
  assert.ok(existsSync(join(root, ".factory", "constitution.md")));
  const constitution = readFileSync(join(root, ".factory", "constitution.md"), "utf8");
  assert.ok(constitution.length > 5000);
  assert.match(constitution, /Known traps/);
  assert.match(constitution, /Build the least that works/);
  assert.equal(readdirSync(join(root, ".factory", "roles")).length, 5);
  assert.ok(existsSync(join(root, ".factory", "templates", "spec.md")));
  assert.match(readFileSync(join(root, ".factory", "templates", "spec.md"), "utf8"), /## Acceptance checks/);
  assert.ok(!existsSync(join(root, "lessons")), "init must not add a lessons folder to the project");
});

test("lesson new: writes a dated lesson and adds the legal note", async (t) => {
  const root = temp(t);
  const code = await lessonNew(root, {
    title: "Saved but not saved",
    what: "The toast said saved and nothing was written.",
    check: "Reload and query the record.",
    example: "A booking form in a client app.",
    sa: "yes",
  });
  assert.equal(code, 0);

  const files = readdirSync(join(root, "lessons")).filter((file) => file !== "_template.md");
  assert.equal(files.length, 1);
  assert.ok(existsSync(join(root, "lessons", "_template.md")), "the template arrives with the first lesson");
  const text = readFileSync(join(root, "lessons", files[0]), "utf8");
  assert.match(text, /Saved but not saved/);
  assert.match(text, /Not legal advice/);
  assert.match(text, /Date: \d{4}-\d{2}-\d{2}/);
});

test("lesson new: refuses an empty lesson", async (t) => {
  const root = temp(t);
  const code = await lessonNew(root, { yes: true });
  assert.equal(code, 1);
});

test("report: needs a verification first", async (t) => {
  const root = temp(t);
  const code = await report(root, {});
  assert.equal(code, 1);
});

test("report: writes a handover with the limits stated", async (t) => {
  const root = temp(t);
  writeFileSync(join(root, "app.js"), "1;\n");
  const run = verify(root, { deep: false });
  assert.ok(run.jsonFile);

  const out = join(root, "handover.md");
  const code = await report(root, { out });
  assert.equal(code, 0);
  const text = readFileSync(out, "utf8");
  assert.match(text, /What this does not prove/);
  assert.match(text, /POPIA/);
  assert.match(text, /factory verify --deep/);
});
