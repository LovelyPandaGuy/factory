#!/usr/bin/env node
// Is this migration really live? Reads one or more migration files, lists the
// objects they create (functions, policies, added columns, dropped policies)
// and checks each one against the live database. Read-only: it runs SELECTs
// on the catalogue and changes nothing.
//
//   node scripts/check-migrations.mjs migrations/rls/0007_*.sql
//   SUPABASE_QUERY_ARGS="--project-ref <ref>" node scripts/check-migrations.mjs <file>
//
// Needs the Supabase CLI, signed in (`supabase login`), run from the folder
// that holds `supabase/`. It calls `supabase db query --linked`. If the CLI
// says the project is not linked, pass the ref in SUPABASE_QUERY_ARGS.
// Exit 0 = everything the files create is live. Exit 1 = something is missing:
// the migration was written but not applied, and the release is blocked
// (constitution, Release gate).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node check-migrations.mjs <migration.sql> [...]");
  process.exit(2);
}
const extra = (process.env.SUPABASE_QUERY_ARGS ?? "").split(" ").filter(Boolean);

function query(sql) {
  const out = execFileSync(
    "supabase",
    ["db", "query", "--linked", ...extra, "--output-format", "json", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed = JSON.parse(out.slice(out.indexOf("{")));
  if (parsed._tag === "Error") throw new Error(parsed.error?.message ?? out);
  return parsed.rows ?? [];
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;
const stripComments = (sql) =>
  sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const functions = new Set();
const policies = new Map(); // "table|name" -> functions the policy body uses
const dropped = new Set(); // "table|name"
const columns = new Set(); // "table|column"

for (const file of files) {
  const sql = stripComments(readFileSync(file, "utf8"));
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?/gi)) {
    functions.add(m[1]);
  }
  for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?"?(\w+)"?/gi)) {
    dropped.add(`${m[2]}|${m[1]}`);
  }
  for (const m of sql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?(\w+)"?([\s\S]*?);/gi)) {
    const uses = [...m[3].matchAll(/(?:public\.)?(\w+)\s*\(/g)].map((u) => u[1]);
    policies.set(`${m[2]}|${m[1]}`, uses);
    dropped.delete(`${m[2]}|${m[1]}`);
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?([\s\S]*?);/gi)) {
    for (const c of m[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) {
      columns.add(`${m[1]}|${c[1]}`);
    }
  }
}

let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};

if (functions.size) {
  const live = new Set(
    query(
      `select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and proname in (${[...functions].map(quote).join(",")})`,
    ).map((r) => r.proname),
  );
  for (const fn of functions) check(live.has(fn), `function ${fn}() exists`);
}

if (policies.size || dropped.size) {
  const live = new Map(
    query(
      "select tablename, policyname, coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr from pg_policies where schemaname = 'public'",
    ).map((r) => [`${r.tablename}|${r.policyname}`, r.expr]),
  );
  for (const [key, uses] of policies) {
    const [table, name] = key.split("|");
    const expr = live.get(key);
    check(expr !== undefined, `policy "${name}" on ${table} exists`);
    // Same name is not proof: a migration often drops and re-creates a policy
    // under its old name. Check the live rule calls what the new one calls.
    for (const fn of uses.filter((u) => functions.has(u))) {
      check(Boolean(expr?.includes(fn)), `policy "${name}" on ${table} uses ${fn}()`);
    }
  }
  for (const key of dropped) {
    const [table, name] = key.split("|");
    check(!live.has(key), `policy "${name}" on ${table} is gone`);
  }
}

if (columns.size) {
  const live = new Set(
    query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    ).map((r) => `${r.table_name}|${r.column_name}`),
  );
  for (const key of columns) {
    const [table, column] = key.split("|");
    check(live.has(key), `column ${table}.${column} exists`);
  }
}

if (!functions.size && !policies.size && !dropped.size && !columns.size) {
  console.log("Nothing this script knows how to check (functions, policies, columns).");
}
process.exit(failed ? 1 : 0);
