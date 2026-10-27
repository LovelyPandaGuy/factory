import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { presetName } from "./agents.js";

const WINDOWS = process.platform === "win32";
const LOCAL = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// MCP servers that drive a browser: in the project (.mcp.json, .claude/settings.json) and
// in Claude Code's own config (~/.claude.json: for every project, and for this one). Only
// names are read, never their settings' values.
export function browserServers(root, home = homedir()) {
  const found = new Map();
  const add = (servers) => {
    for (const [name, settings] of Object.entries(servers ?? {})) {
      const text = `${name} ${JSON.stringify(settings ?? {})}`;
      const browser = /chrome|chromium/i.test(text) ? "chrome" : /firefox/i.test(text) ? "firefox" : null;
      if (browser && !found.has(name)) found.set(name, { name, browser });
    }
  };
  add(readJson(join(root, ".mcp.json"))?.mcpServers);
  add(readJson(join(root, ".claude", "settings.json"))?.mcpServers);
  const user = readJson(join(home, ".claude.json"));
  add(user?.projects?.[resolve(root)]?.mcpServers);
  add(user?.mcpServers);
  return [...found.values()];
}

// Which tool the agent uses to work the app like a person, and what it may run.
export function pickDriver(root, analysis, config, { home } = {}) {
  if (config.journeys?.enabled === false) return { driver: null, reason: "journeys.enabled is false in factory.config.json" };
  const kind = analysis.stack.kind;
  if (kind === "web") {
    if (analysis.drivers.includes("playwright")) return { driver: "playwright", tools: ["Bash(npx playwright:*)"] };
    const servers = browserServers(root, home);
    const pick = servers.find((server) => server.browser === "chrome") ?? servers.find((server) => server.browser === "firefox");
    if (pick) return { driver: `${pick.browser}-devtools-mcp`, server: pick.name, tools: [`mcp__${pick.name}`] };
    return {
      driver: null,
      reason: "No browser tool found. Add the Chrome DevTools or Firefox DevTools MCP server to your agent, or Playwright to the project",
    };
  }
  if (kind === "mobile") {
    if (analysis.drivers.includes("maestro")) return { driver: "maestro", tools: ["Bash(maestro:*)", "Bash(./scripts/e2e.sh:*)"] };
    return { driver: null, reason: "No Maestro flows found (.maestro/); phone journeys need Maestro and a running simulator" };
  }
  return { driver: null, reason: "Not a website or phone app" };
}

// The agent that walks the journeys. Claude Code is given exactly the driver's tools;
// other agents need agent.journeys set to a command that can drive the browser.
export function journeyAgent(config, info) {
  if (config.agent.journeys) return { ...config, agent: { ...config.agent.journeys } };
  if (presetName(config.agent.command) !== "claude") return null;
  return { ...config, agent: { ...config.agent, args: [...(config.agent.args ?? []), "--allowedTools", ...info.tools] } };
}

export function appUrlAllowed(url, config) {
  try {
    return LOCAL.test(new URL(url).hostname) || config.checks?.allowRemoteApp === true;
  } catch {
    return false;
  }
}

// How to start the app: the dev or start script through the package manager, so local
// binaries are on the path.
export function startCommand(root, stack) {
  for (const base of ["", stack.primary].filter((b) => b !== null && b !== undefined)) {
    const scripts = readJson(join(root, base, "package.json"))?.scripts ?? {};
    const pm = stack.packageManager ?? "npm";
    if (scripts.dev) return { command: `${pm} run dev`, cwd: base || null };
    if (scripts.start) return { command: `${pm} run start`, cwd: base || null };
  }
  return null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function httpUp(url) {
  const probe = "fetch(process.argv[1]).then((r) => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))";
  return spawnSync(process.execPath, ["-e", probe, url], { timeout: 5000, stdio: "ignore" }).status === 0;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// A port nothing is using, so the app under test never collides with one already running
// (a person's own dev server is often on 3000).
export function freePort() {
  const script = 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close()})';
  const run = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 5000 });
  const port = Number.parseInt(run.stdout, 10);
  return Number.isFinite(port) ? port : 4317;
}

const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+/g;

// Starts the app in the background on its own port, writing its output to logFile, and
// waits until it answers. It trusts only the address this app prints, or the port it was
// given; an address that already answered before the app started belongs to something
// else, and is never used.
export function startApp(root, { command, cwd }, { logFile, url = null, timeoutSeconds = 60 } = {}) {
  if (url && httpUp(url)) {
    return {
      error: `something is already answering at ${url}, perhaps another copy of the app. Stop it, or change checks.appUrl`,
      stop: () => {},
    };
  }
  const port = freePort();
  const fd = openSync(logFile, "w");
  const child = spawn(command, {
    cwd: cwd ? join(root, cwd) : root,
    shell: true,
    detached: !WINDOWS,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, BROWSER: "none", PORT: String(port) },
  });
  closeSync(fd);
  child.unref();

  const stop = () => {
    try {
      if (WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch {}
  };

  const ours = `http://localhost:${port}`;
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (!alive(child.pid)) return { error: "the app stopped before it answered", stop };
    const printed = [...readFileSync(logFile, "utf8").matchAll(LOCAL_URL)].map((m) => m[0].replace("0.0.0.0", "localhost"));
    const candidates = [...new Set([url, ...printed, ours].filter(Boolean))];
    const answering = candidates.find((candidate) => httpUp(candidate));
    if (answering) return { url: answering, port, stop };
    sleep(1000);
  }
  stop();
  return { error: `the app did not answer within ${timeoutSeconds} seconds`, stop };
}

function rows(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 4 && !/^check$/i.test(cells[0]));
}

const result = (status, summary, details = [], evidence = []) => ({
  id: "journeys",
  title: "Used the app",
  kind: "proven",
  status,
  summary,
  details,
  evidence,
});

export function journeysResultNa(reason) {
  return result("na", reason);
}

export function journeysResultNotRun(reason, details = [], evidence = []) {
  return result("not-run", reason, details, evidence);
}

// Every journey marked PASS must point at a screenshot (or, for Maestro, an output file)
// that exists. A claim with no picture is not proof.
export function checkJourneys(root, dir) {
  const file = join(dir, "journeys.md");
  const shown = (path) => path.replace(`${root}/`, "");
  if (!existsSync(file)) return result("fail", "No journeys recorded: the agent did not write journeys.md");
  const all = rows(readFileSync(file, "utf8"));
  if (!all.length) return result("fail", "journeys.md has no journeys in its table", [], [shown(file)]);
  if (all.every((cells) => /^skip$/i.test(cells[3]))) return result("na", "Nothing a person sees changed", [], [shown(file)]);

  const problems = [];
  let passed = 0;
  for (const [check, , saw, verdict, picture = ""] of all) {
    if (/^skip$/i.test(verdict)) continue;
    if (/^fail$/i.test(verdict)) {
      problems.push(`${check}: FAIL. ${saw}`);
      continue;
    }
    const path = picture.replace(/^`|`$/g, "");
    const full = isAbsolute(path) ? path : existsSync(join(root, path)) ? join(root, path) : join(dir, path);
    let ok = false;
    try {
      ok = Boolean(path) && statSync(full).size > 0;
    } catch {}
    if (/^pass$/i.test(verdict) && ok) passed++;
    else problems.push(`${check}: marked ${verdict || "nothing"} with no screenshot at ${path || "(none given)"}`);
  }

  if (problems.length) return result("fail", `${problems.length} ${problems.length === 1 ? "journey" : "journeys"} not proven`, problems, [shown(file)]);
  return result("pass", `${passed} ${passed === 1 ? "journey" : "journeys"} worked, each with a screenshot`, [], [shown(file)]);
}
