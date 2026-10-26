import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyseProject } from "../lib/analyse.js";
import { askQuestions } from "../lib/interview.js";

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), "factory-analyse-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, path, text) {
  const file = join(root, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
}

test("analyse: reads the project without leaking values", (t) => {
  const root = temp(t);
  write(
    root,
    "package.json",
    JSON.stringify({
      dependencies: { next: "1", react: "1" },
      scripts: { dev: "next dev", test: "vitest", build: "next build" },
    }),
  );
  write(root, "app/bookings/page.tsx", "export default function Page() { return null; }\n");
  write(root, "supabase/migrations/001.sql", "create table booking (id int);\n");
  write(root, ".env.example", "SUPABASE_KEY=super-secret-value\nPUBLIC_URL=http://localhost\n");
  write(root, "README.md", "# Clinic bookings\n\nBookings for a clinic.\n");
  write(root, "app/bookings/page.test.tsx", "test('x', () => { expect(1).toBe(1); });\n");
  write(root, ".maestro/booking.yaml", "appId: clinic\n");
  write(root, "playwright.config.ts", "export default {};\n");
  write(
    root,
    ".mcp.json",
    JSON.stringify({ mcpServers: { firefox: { command: "npx", args: ["firefox-devtools-mcp"] } } }),
  );

  const analysis = analyseProject(root);
  const text = analysis.lines.join("\n");

  assert.match(text, /next \/ javascript, npm/);
  assert.match(text, /1 page/);
  assert.match(text, /Start: next dev/);
  assert.match(text, /Tests: npm test/);
  assert.match(text, /Data: supabase\/migrations \(1\)/);
  assert.match(text, /Env keys: SUPABASE_KEY, PUBLIC_URL \(names only\)/);
  assert.match(text, /Drivers: playwright, firefox-devtools-mcp, maestro/);
  assert.match(text, /README: Bookings for a clinic\./);
  assert.ok(!text.includes("super-secret-value"), "env values must never be read into the brief");
});

test("interview: asks all seven questions and keeps the answers", async () => {
  const values = [
    "People double-book the same slot",
    "Patients, they phone instead",
    "The second booking is refused",
    "Existing bookings",
    "The clinic admin",
    "Two people tapping at once, offline",
    "No redesign",
  ];
  let index = 0;
  const rl = { question: async () => values[index++] };

  const answers = await askQuestions(rl);
  assert.equal(answers.problem, "People double-book the same slot");
  assert.equal(answers.outcome, "The second booking is refused");
  assert.equal(answers.out, "No redesign");
  assert.equal(Object.keys(answers).length, 7);
});

test("interview: will not move on without a problem", async () => {
  const values = ["", "A real problem", "x", "y", "z", "a", "b", "c"];
  let index = 0;
  const rl = { question: async () => values[index++] };

  const answers = await askQuestions(rl);
  assert.equal(answers.problem, "A real problem");
});

test("analyse: sees Chrome as well as Firefox, and Safari when configured", (t) => {
  const root = temp(t);
  write(root, "package.json", JSON.stringify({ dependencies: { react: "1" } }));
  write(
    root,
    ".mcp.json",
    JSON.stringify({
      mcpServers: {
        chrome: { command: "npx", args: ["chrome-devtools-mcp"] },
        webkit: { command: "safaridriver", args: ["--port", "0"] },
      },
    }),
  );

  const analysis = analyseProject(root);
  assert.match(analysis.lines.join("\n"), /Drivers: chrome-devtools-mcp, safari/);
});
