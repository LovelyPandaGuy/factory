import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { notAProjectFolder } from "../lib/cli.js";

test("start: the home folder is refused with a plain way forward", () => {
  const message = notAProjectFolder("/Users/someone", "/Users/someone");
  assert.match(message, /your home folder, not a project/);
  assert.match(message, /cd my-project/);
});

test("start: the top of the disk is refused", () => {
  assert.match(notAProjectFolder("/", "/Users/someone"), /the top of your disk/);
});

test("start: a project folder inside home is allowed", () => {
  assert.equal(notAProjectFolder(join("/Users/someone", "shop"), "/Users/someone"), null);
});
