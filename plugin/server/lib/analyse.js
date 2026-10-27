import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { detectStack } from "./detect.js";
import { browserServers } from "./journeys.js";
import { listSpecs } from "./spec.js";
import { isTestFile, plural, rel, walk } from "./util.js";

const NOTABLE = [
  "expo", "react-native", "next", "nuxt", "astro", "svelte", "vue", "@angular/core", "react",
  "@supabase/supabase-js", "firebase", "drizzle-orm", "prisma", "@prisma/client", "mongoose",
  "express", "hono", "fastify", "@nestjs/core", "tailwindcss", "stripe",
];
const PY_NOTABLE = ["django", "fastapi", "flask", "sqlalchemy", "pydantic", "pytest"];
const TEMPLATE_README = /turborepo starter|create react app|create-next-app|expo app|vite \+ react|next\.js app|bootstrapped with/i;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const count = plural;

function underPrefix(prefix) {
  return (path) => !prefix || path === prefix || path.startsWith(`${prefix}/`);
}

// Screens a person can open: Next.js pages, Expo Router files, React Native screens.
function countScreens(relFiles, stack) {
  const inPrimary = underPrefix(stack.primary);
  const code = relFiles.filter((path) => /\.[cm]?[jt]sx?$/.test(path) && !isTestFile(path) && inPrimary(path));
  if (stack.kind === "web") {
    return code.filter(
      (path) =>
        /(?:^|\/)app\/(?:.+\/)?page\.[cm]?[jt]sx?$/.test(path) ||
        (/(?:^|\/)pages\/.+/.test(path) && !/(?:^|\/)pages\/(?:_app|_document|_error|api\/)/.test(path)),
    ).length;
  }
  if (stack.kind === "mobile") {
    return code.filter(
      (path) =>
        /(?:^|\/)screens\/[^/]+\.[jt]sx?$/.test(path) ||
        /(?:^|\/)screens\/[^/]+\/index\.[jt]sx?$/.test(path) ||
        /(?:^|\/)app\/(?:[^/]+\/)*[^_+/][^/]*\.[jt]sx?$/.test(path),
    ).length;
  }
  return 0;
}

function migrationInfo(root, stack) {
  const bases = ["", ...stack.workspaces.map((w) => `${w.path}/`)];
  const found = [];
  for (const base of bases) {
    for (const name of ["supabase/migrations", "migrations", "db/migrations", "prisma/migrations", "drizzle"]) {
      const dir = `${base}${name}`;
      if (!existsSync(join(root, dir))) continue;
      try {
        const files = readdirSync(join(root, dir)).filter((file) => /\.(?:sql|ts|js|prisma)$/.test(file));
        if (files.length) found.push(`${dir} (${files.length})`);
      } catch {}
    }
    if (existsSync(join(root, `${base}prisma`, "schema.prisma"))) found.push(`${base}prisma/schema.prisma`);
  }
  return found;
}

function envKeys(root, stack) {
  const bases = ["", ...stack.workspaces.map((w) => `${w.path}/`)];
  const keys = new Set();
  for (const base of bases) {
    for (const name of [".env.example", ".env.sample", ".env.template"]) {
      const file = join(root, `${base}${name}`);
      if (!existsSync(file)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/^([A-Z0-9_]+)\s*=/gm)) keys.add(match[1]);
    }
  }
  return [...keys];
}

function authFiles(relFiles) {
  return relFiles
    .filter((file) => /(?:^|[\\/_-])(?:auth|login|session|supabase)[^\\/]*\.[cm]?[jt]sx?$/i.test(file) && !isTestFile(file))
    .slice(0, 6);
}

function packageDrivers(deps) {
  const known = [
    ["@playwright/test", "playwright"],
    ["playwright", "playwright"],
    ["puppeteer", "puppeteer"],
    ["cypress", "cypress"],
    ["webdriverio", "webdriverio"],
    ["selenium-webdriver", "selenium"],
  ];
  const found = [];
  for (const [dep, label] of known) {
    if (deps.includes(dep) && !found.includes(label)) found.push(label);
  }
  return found;
}

function mcpBrowsers(root) {
  const found = [];
  for (const name of [".mcp.json", join(".claude", "settings.json")]) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    let text = readFileSync(file, "utf8");
    try {
      text = JSON.stringify(JSON.parse(text));
    } catch {}
    if (/(?:chrome|chromium)/i.test(text)) found.push("chrome-devtools-mcp");
    if (/firefox/i.test(text)) found.push("firefox-devtools-mcp");
    if (/(?:safari|webkit)/i.test(text)) found.push("safari");
  }
  return found;
}

function drivers(root, deps, stack) {
  const found = [];
  const bases = ["", ...stack.workspaces.map((w) => `${w.path}/`)];
  for (const base of bases) {
    if (["playwright.config.ts", "playwright.config.js"].some((name) => existsSync(join(root, `${base}${name}`)))) {
      found.push("playwright");
    }
    if (["cypress.config.ts", "cypress.config.js"].some((name) => existsSync(join(root, `${base}${name}`)))) {
      found.push("cypress");
    }
  }
  found.push(...packageDrivers(deps), ...mcpBrowsers(root));
  if (bases.some((base) => [".maestro", "maestro"].some((name) => existsSync(join(root, `${base}${name}`))))) {
    found.push("maestro");
  }
  return [...new Set(found)];
}

function readmeLine(root, stack) {
  for (const base of ["", stack.primary ? `${stack.primary}/` : null].filter((b) => b !== null)) {
    const file = ["README.md", "readme.md", "README"].map((name) => join(root, `${base}${name}`)).find((f) => existsSync(f));
    if (!file) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item && !item.startsWith("#") && !item.startsWith("<") && !item.startsWith("!["));
    if (line && !TEMPLATE_README.test(line)) return line.slice(0, 160);
  }
  return "";
}

function describeStack(stack) {
  const name = (w) => (w.kind === "api" && w.framework ? `${w.framework} api` : w.framework ?? w.kind);
  if (stack.workspaces.length) {
    const ordered = [...stack.workspaces].sort((a, b) => (b.path === stack.primary) - (a.path === stack.primary));
    const kinds = [...new Set(ordered.filter((w) => w.kind !== "script").map(name))];
    const paths = stack.workspaces.map((w) => w.path);
    const shown = paths.length > 4 ? `${paths.slice(0, 4).join(", ")}, and ${paths.length - 4} more` : paths.join(", ");
    return `${kinds.join(" + ") || "javascript"} (monorepo: ${shown}${stack.packageManager ? `, ${stack.packageManager}` : ""})`;
  }
  const what = stack.framework ?? stack.kind;
  const language = stack.language && stack.language !== stack.framework ? ` / ${stack.language}` : "";
  return `${what}${language}${stack.packageManager ? `, ${stack.packageManager}` : ""}`;
}

function notableLibraries(root, stack, pkg) {
  const primaryPkg = stack.primary ? readJson(join(root, stack.primary, "package.json")) : null;
  const deps = new Set(
    [pkg, primaryPkg].flatMap((p) => Object.keys({ ...(p?.dependencies ?? {}), ...(p?.devDependencies ?? {}) })),
  );
  const found = NOTABLE.filter((name) => deps.has(name));
  if (stack.language === "python") {
    const text = ["pyproject.toml", "requirements.txt"]
      .map((name) => join(root, name))
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file, "utf8").toLowerCase())
      .join("\n");
    found.push(...PY_NOTABLE.filter((name) => new RegExp(`\\b${name}\\b`).test(text)));
  }
  return found.length ? found : [...deps].slice(0, 8);
}

export function analyseProject(root) {
  const stack = detectStack(root);
  const pkg = existsSync(join(root, "package.json")) ? readJson(join(root, "package.json")) : null;
  const files = walk(root);
  const relFiles = files.map((file) => rel(root, file).split("\\").join("/"));
  const screens = countScreens(relFiles, stack);
  const tests = relFiles.filter(isTestFile);
  const specs = listSpecs(root);
  const migrations = migrationInfo(root, stack);
  const env = envKeys(root, stack);
  const auth = authFiles(relFiles);
  const allDeps = [pkg, ...stack.workspaces.map((w) => readJson(join(root, w.path, "package.json")))].flatMap((p) =>
    Object.keys({ ...(p?.dependencies ?? {}), ...(p?.devDependencies ?? {}) }),
  );
  const availableDrivers = drivers(root, allDeps, stack);
  const readme = readmeLine(root, stack);
  const libraries = notableLibraries(root, stack, pkg);

  const scripts = pkg?.scripts ?? {};
  const primaryScripts = stack.primary ? readJson(join(root, stack.primary, "package.json"))?.scripts ?? {} : {};
  const startCommand =
    scripts.dev ??
    scripts.start ??
    primaryScripts.dev ??
    primaryScripts.start ??
    (stack.framework === "expo" ? "npx expo start" : null);

  const label = describeStack(stack);
  const counts = [count(files.length, "file")];
  if (stack.kind === "web" || stack.kind === "mobile") counts.push(stack.kind === "web" ? count(screens, "page") : count(screens, "screen"));
  counts.push(count(tests.length, "test file"));
  if (specs.length) counts.push(count(specs.length, "spec"));

  const run = [
    startCommand && `Start: ${startCommand}`,
    stack.testCommand && `Tests: ${stack.testCommand}${stack.commandCwd ? ` (in ${stack.commandCwd})` : ""}`,
    stack.buildCommand && `Build: ${stack.buildCommand}`,
  ].filter(Boolean);

  // Short form, for the first run.
  const summary = [label, counts.join(", ")];
  if (run.length) summary.push(run.join("   "));
  const data = [migrations.length && `Data: ${migrations.join(", ")}`, env.length && `Env keys: ${env.length} (names only)`].filter(Boolean);
  if (data.length) summary.push(data.join("   "));
  const usable = [...new Set([...availableDrivers, ...browserServers(root).map((server) => `${server.browser}-devtools-mcp`)])];
  if (usable.length && (stack.kind === "web" || stack.kind === "mobile")) summary.push(`Can use the app with: ${usable.join(", ")}`);

  // Long form, for the agent's brief.
  const lines = [label, counts.join(", "), ...run];
  if (libraries.length) lines.push(`Libraries: ${libraries.slice(0, 12).join(", ")}`);
  if (migrations.length) lines.push(`Data: ${migrations.join(", ")}`);
  if (auth.length) lines.push(`Auth: ${auth.join(", ")}`);
  if (env.length) lines.push(`Env keys: ${env.slice(0, 15).join(", ")} (names only)`);
  if (availableDrivers.length) lines.push(`Drivers: ${availableDrivers.join(", ")}`);
  if (readme) lines.push(`README: ${readme}`);

  return {
    stack,
    label,
    summary,
    lines,
    brief: lines.join("\n"),
    empty: files.length === 0,
    screens,
    tests,
    specs,
    env,
    drivers: availableDrivers,
    startCommand,
  };
}
