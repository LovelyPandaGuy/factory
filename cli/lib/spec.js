import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { readConfig, writeConfig } from "./config.js";

export const SPECS_DIR = "specs";

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "spec"
  );
}

export function listSpecs(root) {
  const dir = join(root, SPECS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function nextSpecName(root, title) {
  const numbers = listSpecs(root)
    .map((name) => Number.parseInt(name.slice(0, 3), 10))
    .filter((number) => Number.isFinite(number));
  const next = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, "0");
  return `${next}-${slugify(title)}`;
}

export function specDir(root, name) {
  return join(root, SPECS_DIR, name);
}

export function specPaths(root, name) {
  const dir = specDir(root, name);
  return {
    dir,
    spec: join(dir, "spec.md"),
    plan: join(dir, "plan.md"),
    tasks: join(dir, "tasks.md"),
    approval: join(dir, "approval.json"),
  };
}

export function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function readApproval(root, name) {
  const file = specPaths(root, name).approval;
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function readArtifacts(root, name) {
  const files = specPaths(root, name);
  const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
  return {
    name,
    ...files,
    spec: read(files.spec),
    plan: read(files.plan),
    tasks: read(files.tasks),
    approval: readApproval(root, name),
  };
}

export function approvalState(root, name) {
  const artifacts = readArtifacts(root, name);
  if (!artifacts.spec.trim()) return { state: "missing", artifacts };
  if (!artifacts.approval) return { state: "draft", artifacts };
  if (artifacts.approval.hash !== hashText(artifacts.spec)) {
    return { state: "stale", artifacts };
  }
  return { state: "approved", artifacts };
}

export function activeSpec(root) {
  const config = readConfig(root);
  const name = config.spec?.active;
  if (!name) return null;
  if (!existsSync(specPaths(root, name).spec)) return null;
  return { name, ...approvalState(root, name) };
}

export function findSpec(root, query) {
  const names = listSpecs(root);
  if (!query) return null;
  return (
    names.find((name) => name === query) ||
    names.find((name) => name.startsWith(query)) ||
    names.find((name) => name.includes(query)) ||
    null
  );
}

export function setActive(root, name) {
  const config = readConfig(root);
  config.spec = { ...config.spec, active: name };
  writeConfig(root, config);
  return config;
}

export function approve(root, name, by, how = null) {
  const artifacts = readArtifacts(root, name);
  if (!artifacts.spec.trim()) return null;
  const approval = {
    spec: name,
    hash: hashText(artifacts.spec),
    approvedAt: new Date().toISOString(),
    approvedBy: String(by || "").trim() || gitUser(root) || userInfo().username || "unknown",
    ...(how ? { how } : {}),
  };
  mkdirSync(specPaths(root, name).dir, { recursive: true });
  writeFileSync(specPaths(root, name).approval, `${JSON.stringify(approval, null, 2)}\n`);
  return approval;
}

export function gitUser(root) {
  const result = spawnSync("git", ["config", "user.name"], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}
